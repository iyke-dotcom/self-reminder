import {
  addMemberById,
  addNote,
  canUseGroups,
  getUserId,
  createEvent,
  createGroup,
  deleteEvent,
  deleteGroup,
  deleteNote,
  editNote,
  getGroup,
  inviteLink,
  joinGroup,
  leaveGroup,
  markSeen,
  previewInvite,
  promoteMember,
  refreshInvite,
  removeMember,
  rsvp,
  searchUsers,
  fetchFeed,
  unhideNote,
  updateGroup,
} from "../groups.js";
import {
  GROUP_TYPES,
  REMINDER_PRESETS,
  templateFor,
} from "../groupTemplates.js";
import { formatDateTime } from "../../utils/date.js";

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children.flat(9)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

function summaryText(summary) {
  const s = summary || { going: 0, maybe: 0, declined: 0 };
  return `${s.going} going · ${s.maybe} maybe · ${s.declined} declined`;
}

async function withBusy(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// View: lists (groups + upcoming events + badges)
// ---------------------------------------------------------------------------
function eventRow(item, groupName, { onOpen }) {
  const li = el("li");
  const content = el("div", { className: "content" });
  const titleRow = el("div", { className: "title-row" });
  const title = el("button", {
    type: "button",
    className: "title",
    text: item.title,
    onclick: onOpen,
  });
  title.setAttribute("aria-label", `Open ${item.title}`);
  const badges = el("span", { className: "badges" });
  const groupBadge = el("span", {
    className: "badge badge--tag",
    text: groupName,
  });
  badges.append(groupBadge);
  if (!item.myRsvp) {
    badges.append(
      el("span", { className: "badge badge--recurring", text: "RSVP needed" }),
    );
  } else if (item.myRsvp === "declined") {
    badges.append(el("span", { className: "badge", text: "opted out" }));
  }
  titleRow.append(title, badges);
  const time = el("span", {
    className: "time",
    text: formatDateTime(item.date),
  });
  const sub = el("div", { className: "meta", text: summaryText(item.summary) });
  content.append(titleRow, time, sub);
  li.append(content);
  return li;
}

// ---------------------------------------------------------------------------
// View: event card (RSVP + notes), shared by detail and upcoming lists
// ---------------------------------------------------------------------------
function noteItem(groupId, eventId, note, detail, ctx) {
  const { session, fail, changed } = ctx;
  const isAuthor = note.userId === session.userId;
  const isAdmin = detail.myRole === "admin";
  const wrap = el("div", { className: "note" });
  const head = el("div", { className: "title-row" });
  head.append(
    el("strong", { text: note.author }),
    el("span", {
      className: "time",
      text: new Date(note.createdAt).toLocaleString(),
    }),
  );
  if (note.privateToAdmins) {
    head.append(
      el("span", {
        className: "badge badge--tag",
        text: "private to organizers",
      }),
    );
  }
  if (note.hidden) {
    head.append(el("span", { className: "badge", text: "hidden" }));
  }
  const body = el("p", { text: note.body });
  wrap.append(head, body);
  const actions = el("div", { className: "login-actions" });
  if (isAuthor && !note.hidden) {
    actions.append(
      el("button", {
        type: "button",
        className: "btn",
        text: "Edit",
        onclick: (e) => {
          const area = el("textarea", { text: note.body });
          area.rows = 3;
          const save = el("button", {
            type: "button",
            className: "btn primary",
            text: "Save",
            onclick: (ev) =>
              withBusy(ev.target, async () => {
                try {
                  await editNote(groupId, eventId, note.id, area.value);
                  await changed();
                } catch (error) {
                  fail(error);
                }
              }),
          });
          body.replaceWith(area, save);
          e.target.remove();
        },
      }),
      el("button", {
        type: "button",
        className: "btn",
        text: "Delete",
        onclick: (e) => {
          if (!window.confirm("Delete your note?")) return;
          return withBusy(e.target, async () => {
            try {
              await deleteNote(groupId, eventId, note.id);
              await changed();
            } catch (error) {
              fail(error);
            }
          });
        },
      }),
    );
  }
  if (isAdmin && !isAuthor) {
    actions.append(
      el("button", {
        type: "button",
        className: "btn",
        text: note.hidden ? "Unhide" : "Hide",
        onclick: (e) =>
          withBusy(e.target, async () => {
            try {
              if (note.hidden) await unhideNote(groupId, eventId, note.id);
              else await deleteNote(groupId, eventId, note.id);
              await changed();
            } catch (error) {
              fail(error);
            }
          }),
      }),
    );
  }
  if (actions.childElementCount > 0) wrap.append(actions);
  return wrap;
}

function eventCard(group, item, detail, ctx) {
  const { session, fail, changed } = ctx;
  const template = templateFor(group.type);
  const card = el("div", { className: "event-card" });
  const event = item.event || item;
  const summary = item.summary || { going: 0, maybe: 0, declined: 0 };
  const myRsvp = item.myRsvp || null;

  card.append(
    el("h4", { text: `${template.icon} ${event.title}` }),
    el("div", { className: "time", text: formatDateTime(event.date) }),
  );
  if (event.location) card.append(el("div", { text: `📍 ${event.location}` }));
  if (event.description) card.append(el("p", { text: event.description }));
  card.append(el("div", { className: "meta", text: summaryText(summary) }));

  const rsvpRow = el("div", { className: "login-actions" });
  for (const [status, label] of [
    ["going", "Going ✅"],
    ["maybe", "Maybe ❓"],
    ["declined", "Can't make it ❌"],
  ]) {
    rsvpRow.append(
      el("button", {
        type: "button",
        className: myRsvp === status ? "btn primary" : "btn",
        text: label,
        onclick: (e) =>
          withBusy(e.target, async () => {
            try {
              await rsvp(group.id, event.id, status);
              await changed();
            } catch (error) {
              fail(error);
            }
          }),
      }),
    );
  }
  card.append(rsvpRow);

  const notesWrap = el("div", { className: "notes" });
  const renderNotes = (notes) => {
    notesWrap.replaceChildren();
    if (notes.length === 0) {
      notesWrap.append(el("p", { className: "meta", text: "No notes yet." }));
    }
    for (const note of notes) {
      notesWrap.append(noteItem(group.id, event.id, note, detail, ctx));
    }
  };
  renderNotes(item.notes || []);
  card.append(el("h5", { text: "Notes" }), notesWrap);

  const noteInput = el("textarea", {
    placeholder: template.notePlaceholder,
    "aria-label": "Note text",
  });
  noteInput.rows = 2;
  const privateLabel = el("label", { className: "setting" });
  const privateCheck = el("input", { type: "checkbox" });
  privateLabel.append(privateCheck, " Private to organizers");
  const addBtn = el("button", {
    type: "button",
    className: "btn",
    text: "Add note",
    onclick: (e) =>
      withBusy(e.target, async () => {
        try {
          const body = noteInput.value.trim();
          if (!body) {
            fail(new Error("Write a note first."));
            return;
          }
          await addNote(group.id, event.id, {
            body,
            privateToAdmins: privateCheck.checked,
          });
          await changed();
        } catch (error) {
          fail(error);
        }
      }),
  });
  card.append(noteInput, privateLabel, addBtn);

  const canDelete =
    detail.myRole === "admin" || event.createdBy === session.userId;
  if (canDelete) {
    card.append(
      el("button", {
        type: "button",
        className: "btn",
        text: "Delete event",
        onclick: (e) => {
          if (!window.confirm("Delete this event for everyone?")) return;
          return withBusy(e.target, async () => {
            try {
              await deleteEvent(group.id, event.id);
              await changed();
            } catch (error) {
              fail(error);
            }
          });
        },
      }),
    );
  }
  return card;
}

// ---------------------------------------------------------------------------
// View factory
// ---------------------------------------------------------------------------
export function createGroupsUi({ els, getSession, toast, onFeed }) {
  const fail = (error) => {
    const message = error?.message || "Something went wrong.";
    if (els.groupsStatus) els.groupsStatus.textContent = message;
    toast(message);
  };
  const ctxBase = () => ({
    session: { ...getSession(), userId: getUserId() },
    fail,
    changed: async () => {
      await refresh();
      await route(window.location.hash || "#/app/groups");
    },
  });

  async function refresh() {
    if (!els.groupList) return null;
    if (!canUseGroups()) {
      els.groupList.replaceChildren(
        el("li", {
          text: "Groups need an online account — sign in again with a server account to sync.",
        }),
      );
      if (els.groupEvents) els.groupEvents.replaceChildren();
      return null;
    }
    try {
      if (els.groupsStatus) els.groupsStatus.textContent = "";
      const feed = await fetchFeed();
      onFeed?.(feed);
      const nameOf = new Map(feed.groups.map((g) => [g.id, g.name]));
      els.groupEvents?.replaceChildren(
        ...(feed.upcoming.slice(0, 20).map((item) =>
          eventRow(item, nameOf.get(item.groupId) || "", {
            onOpen: () => {
              window.location.hash = `#/app/groups/${item.groupId}`;
            },
          }),
        ) || []),
      );
      if (feed.upcoming.length === 0 && els.groupEvents) {
        els.groupEvents.replaceChildren(
          el("li", { text: "No upcoming group events." }),
        );
      }
      els.groupList?.replaceChildren(
        ...(feed.groups.map((group) => {
          const template = templateFor(group.type);
          const li = el("li");
          const content = el("div", { className: "content" });
          const titleRow = el("div", { className: "title-row" });
          const open = el("button", {
            type: "button",
            className: "title",
            text: `${template.icon} ${group.name}`,
            onclick: () => {
              window.location.hash = `#/app/groups/${group.id}`;
            },
          });
          titleRow.append(
            open,
            el("span", { className: "badge badge--tag", text: group.type }),
            el("span", {
              className: "badge",
              text: `${group.memberCount} ${template.memberNoun}`,
            }),
          );
          content.append(titleRow);
          li.append(content);
          return li;
        }) || []),
      );
      if (feed.groups.length === 0 && els.groupList) {
        els.groupList.replaceChildren(
          el("li", { text: "No groups yet — create one or join with a code." }),
        );
      }
      const badgeCount = (feed.pendingRsvps || 0) + (feed.unreadNotes || 0);
      if (els.groupsBadge) {
        els.groupsBadge.hidden = badgeCount === 0;
        els.groupsBadge.textContent =
          badgeCount === 0 ? "" : `${badgeCount} new`;
      }
      return feed;
    } catch (error) {
      if (els.groupsStatus) els.groupsStatus.textContent = error.message;
      return null;
    }
  }

  function showDetail() {
    if (els.groupDetail) els.groupDetail.hidden = false;
    els.groupList?.setAttribute("hidden", "");
    els.groupEvents?.setAttribute("hidden", "");
  }

  function showLists() {
    if (els.groupDetail) {
      els.groupDetail.hidden = true;
      els.groupDetail.replaceChildren();
    }
    els.groupList?.removeAttribute("hidden");
    els.groupEvents?.removeAttribute("hidden");
  }

  function renderCreateForm() {
    showDetail();
    const name = el("input", {
      type: "text",
      id: "group-name",
      placeholder: "Group name",
    });
    const description = el("textarea", {
      id: "group-description",
      placeholder: "What is this group for? (optional)",
    });
    const type = el(
      "select",
      { id: "group-type" },
      ...GROUP_TYPES.map((t) =>
        el("option", { value: t, text: `${templateFor(t).icon} ${t}` }),
      ),
    );
    const create = el("button", {
      type: "button",
      className: "primary",
      text: "Create group",
      onclick: (e) =>
        withBusy(e.target, async () => {
          try {
            if (!name.value.trim()) throw new Error("Give the group a name.");
            const group = await createGroup({
              name: name.value,
              description: description.value,
              type: type.value,
            });
            toast(`Group "${group.name}" created — you are its admin.`);
            window.location.hash = `#/app/groups/${group.id}`;
          } catch (error) {
            fail(error);
          }
        }),
    });
    els.groupDetail.replaceChildren(
      el("h3", { text: "New group" }),
      el("label", { text: "Name" }, name),
      el("label", { text: "Description" }, description),
      el("label", { text: "Type" }, type),
      create,
    );
  }

  function renderJoinForm(code) {
    showDetail();
    const input = el("input", {
      type: "text",
      id: "group-code",
      placeholder: "Invite code",
    });
    if (code) input.value = code;
    const preview = el("p", { className: "meta" });
    const join = el("button", {
      type: "button",
      className: "primary",
      text: "Join group",
      onclick: (e) =>
        withBusy(e.target, async () => {
          try {
            const value = input.value.trim();
            if (!value) throw new Error("Paste an invite code first.");
            const result = await joinGroup(value);
            toast(
              result.alreadyMember
                ? "You are already in this group."
                : `Joined "${result.group.name}".`,
            );
            window.location.hash = `#/app/groups/${result.group.id}`;
          } catch (error) {
            fail(error);
          }
        }),
    });
    els.groupDetail.replaceChildren(
      el("h3", { text: "Join with a code" }),
      input,
      preview,
      join,
    );
    const showPreview = async () => {
      const value = input.value.trim();
      if (!value) {
        preview.textContent = "";
        return;
      }
      try {
        const invite = await previewInvite(value);
        preview.textContent = `${invite.name} (${invite.type}) · ${invite.memberCount} members`;
      } catch {
        preview.textContent = "Invalid or expired invite.";
      }
    };
    input.addEventListener("change", showPreview);
    if (code) showPreview();
  }

  function renderEventForm(group) {
    showDetail();
    const template = templateFor(group.type);
    const title = el("input", {
      type: "text",
      id: "group-event-title",
      placeholder: template.eventPlaceholder,
    });
    const description = el("textarea", { placeholder: "Details (optional)" });
    const location = el("input", {
      type: "text",
      placeholder: "Location (optional)",
    });
    const datetime = el("input", {
      type: "datetime-local",
      id: "group-event-date",
    });
    const checks = REMINDER_PRESETS.map((preset) => {
      const box = el("input", { type: "checkbox" });
      box.value = String(preset.minutes);
      box.checked = preset.minutes === 1440 || preset.minutes === 60;
      const label = el("label", { className: "setting" });
      label.append(box, ` ${preset.label}`);
      return { box, label };
    });
    const freq = el(
      "select",
      {},
      ...["", "daily", "weekly", "monthly"].map((f) =>
        el("option", { value: f, text: f ? `Repeats ${f}` : "Doesn't repeat" }),
      ),
    );
    const create = el("button", {
      type: "button",
      className: "primary",
      text: `Create ${template.eventNoun.toLowerCase()}`,
      onclick: (e) =>
        withBusy(e.target, async () => {
          try {
            if (!title.value.trim() || !datetime.value) {
              throw new Error("Title and date are required.");
            }
            await createEvent(group.id, {
              title: title.value,
              description: description.value,
              location: location.value,
              date: new Date(datetime.value).toISOString(),
              reminderOffsets: checks
                .filter((c) => c.box.checked)
                .map((c) => Number(c.box.value)),
              recurring: freq.value ? { freq: freq.value } : null,
            });
            toast("Group event created — members can now RSVP.");
            window.location.hash = `#/app/groups/${group.id}`;
          } catch (error) {
            fail(error);
          }
        }),
    });
    els.groupDetail.replaceChildren(
      el("h3", {
        text: `New ${template.eventNoun.toLowerCase()} in ${group.name}`,
      }),
      el("label", { text: "Title" }, title),
      el("label", { text: "Description" }, description),
      el("label", { text: "Location" }, location),
      el("label", { text: "Date and time" }, datetime),
      el(
        "div",
        {},
        el("strong", { text: "Remind members:" }),
        ...checks.map((c) => c.label),
      ),
      el("label", { text: "Repeat" }, freq),
      create,
    );
  }

  async function renderDetail(id) {
    showDetail();
    const ctx = ctxBase();
    try {
      const detail = await getGroup(id);
      const { group, members, events, myRole } = detail;
      const template = templateFor(group.type);
      const isAdmin = myRole === "admin";
      await markSeen(group.id).catch(() => {});
      await refresh();

      const root = el("div");
      root.append(
        el("button", {
          type: "button",
          className: "btn",
          text: "← All groups",
          onclick: () => {
            window.location.hash = "#/app/groups";
          },
        }),
        el("h3", { text: `${template.icon} ${group.name}` }),
        el("p", {
          className: "meta",
          text: `${group.type} · you are ${myRole}`,
        }),
      );
      if (group.description) root.append(el("p", { text: group.description }));

      // Invite box
      const inviteBox = el("div", { className: "invite-box" });
      const codeLine = el("p", { text: `Invite code: ${group.inviteCode}` });
      const copyBtn = el("button", {
        type: "button",
        className: "btn",
        text: "Copy invite link",
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(inviteLink(group.inviteCode));
            toast("Invite link copied.");
          } catch {
            toast(inviteLink(group.inviteCode));
          }
        },
      });
      inviteBox.append(
        el("h4", { text: "Invite members" }),
        codeLine,
        el("p", {
          className: "meta",
          text: `Code expires ${new Date(group.inviteExpiresAt).toLocaleDateString()}. Max ${50} members.`,
        }),
        copyBtn,
      );
      if (isAdmin) {
        inviteBox.append(
          el("button", {
            type: "button",
            className: "btn",
            text: "Revoke & new code",
            onclick: (e) =>
              withBusy(e.target, async () => {
                try {
                  if (!window.confirm("Revoke the current invite code?"))
                    return;
                  await refreshInvite(group.id);
                  await route(`#/app/groups/${group.id}`);
                } catch (error) {
                  fail(error);
                }
              }),
          }),
        );
      }
      // Username / email search invites
      const search = el("input", {
        type: "search",
        placeholder: "Add by username or email…",
      });
      const results = el("div");
      search.addEventListener("change", async () => {
        results.replaceChildren();
        const q = search.value.trim();
        if (q.length < 2) return;
        try {
          const users = await searchUsers(q);
          if (users.length === 0) {
            results.append(
              el("p", { className: "meta", text: "No users found." }),
            );
          }
          for (const user of users) {
            results.append(
              el(
                "div",
                { className: "title-row" },
                el("span", {
                  text: user.name
                    ? `${user.username} (${user.name})`
                    : user.username,
                }),
                el("button", {
                  type: "button",
                  className: "btn",
                  text: "Add",
                  onclick: (e) =>
                    withBusy(e.target, async () => {
                      try {
                        await addMemberById(group.id, user.id);
                        toast(`${user.username} added.`);
                        await route(`#/app/groups/${group.id}`);
                      } catch (error) {
                        fail(error);
                      }
                    }),
                }),
              ),
            );
          }
        } catch (error) {
          fail(error);
        }
      });
      inviteBox.append(search, results);
      // Contact picker (mobile/modern browsers only)
      if (navigator.contacts && "select" in navigator.contacts) {
        inviteBox.append(
          el("button", {
            type: "button",
            className: "btn",
            text: "Pick from contacts",
            onclick: async (e) =>
              withBusy(e.target, async () => {
                try {
                  const contacts = await navigator.contacts.select(
                    ["name", "email"],
                    { multiple: true },
                  );
                  const emails = [
                    ...new Set(contacts.flatMap((c) => c.email || [])),
                  ].slice(0, 10);
                  if (emails.length === 0) {
                    toast("No emails in the selected contacts.");
                    return;
                  }
                  results.replaceChildren();
                  for (const email of emails) {
                    const users = await searchUsers(email).catch(() => []);
                    for (const user of users.slice(0, 3)) {
                      results.append(
                        el(
                          "div",
                          { className: "title-row" },
                          el("span", { text: `${user.username} (${email})` }),
                          el("button", {
                            type: "button",
                            className: "btn",
                            text: "Add",
                            onclick: (ev) =>
                              withBusy(ev.target, async () => {
                                try {
                                  await addMemberById(group.id, user.id);
                                  toast(`${user.username} added.`);
                                  await route(`#/app/groups/${group.id}`);
                                } catch (err) {
                                  fail(err);
                                }
                              }),
                          }),
                        ),
                      );
                    }
                  }
                } catch (error) {
                  if (error?.name !== "NotAllowedError") fail(error);
                }
              }),
          }),
        );
      }
      root.append(inviteBox);

      // Members
      const memberList = el("ul", { className: "list" });
      for (const member of members) {
        const row = el("li");
        const content = el("div", { className: "content" });
        const titleRow = el("div", { className: "title-row" });
        titleRow.append(
          el("strong", {
            text: member.name
              ? `${member.username} (${member.name})`
              : member.username,
          }),
          el("span", {
            className: "badge badge--tag",
            text: member.label || member.role,
          }),
        );
        content.append(titleRow);
        if (isAdmin && member.userId !== ctx.session.userId) {
          const actions = el("div", { className: "login-actions" });
          if (member.role !== "admin") {
            actions.append(
              el("button", {
                type: "button",
                className: "btn",
                text: "Make admin",
                onclick: (e) =>
                  withBusy(e.target, async () => {
                    try {
                      await promoteMember(group.id, member.userId);
                      await route(`#/app/groups/${group.id}`);
                    } catch (error) {
                      fail(error);
                    }
                  }),
              }),
            );
          }
          actions.append(
            el("button", {
              type: "button",
              className: "btn",
              text: "Remove",
              onclick: (e) => {
                if (
                  !window.confirm(`Remove ${member.username} from the group?`)
                )
                  return;
                return withBusy(e.target, async () => {
                  try {
                    await removeMember(group.id, member.userId);
                    await route(`#/app/groups/${group.id}`);
                  } catch (error) {
                    fail(error);
                  }
                });
              },
            }),
          );
          content.append(actions);
        }
        row.append(content);
        memberList.append(row);
      }
      root.append(
        el("h4", { text: `Members (${members.length})` }),
        memberList,
      );

      // Events
      const canCreate = group.memberEventCreate || isAdmin;
      root.append(el("h4", { text: "Events" }));
      if (canCreate) {
        root.append(
          el("button", {
            type: "button",
            className: "btn primary",
            text: `New ${template.eventNoun.toLowerCase()}`,
            onclick: () => {
              window.location.hash = `#/app/groups/${group.id}/events/new`;
            },
          }),
        );
      } else {
        root.append(
          el("p", {
            className: "meta",
            text: "Only group admins can create events here.",
          }),
        );
      }
      if (events.length === 0) {
        root.append(el("p", { className: "meta", text: "No events yet." }));
      }
      for (const item of events) {
        root.append(eventCard(group, item, detail, ctx));
      }

      // Admin settings + danger zone
      if (isAdmin) {
        const nameEdit = el("input", { type: "text" });
        nameEdit.value = group.name;
        const whoCreates = el("input", { type: "checkbox" });
        whoCreates.checked = group.memberEventCreate;
        const whoLabel = el("label", { className: "setting" });
        whoLabel.append(whoCreates, " Any member can create events");
        root.append(
          el("h4", { text: "Group settings" }),
          el("label", { text: "Rename group" }, nameEdit),
          whoLabel,
          el("button", {
            type: "button",
            className: "btn",
            text: "Save settings",
            onclick: (e) =>
              withBusy(e.target, async () => {
                try {
                  await updateGroup(group.id, {
                    name: nameEdit.value,
                    memberEventCreate: whoCreates.checked,
                  });
                  toast("Group updated.");
                  await route(`#/app/groups/${group.id}`);
                } catch (error) {
                  fail(error);
                }
              }),
          }),
          el("button", {
            type: "button",
            className: "btn",
            text: "Leave group",
            onclick: (e) => {
              if (!window.confirm("Leave this group?")) return;
              return withBusy(e.target, async () => {
                try {
                  await leaveGroup(group.id);
                  window.location.hash = "#/app/groups";
                } catch (error) {
                  fail(error);
                }
              });
            },
          }),
          el("button", {
            type: "button",
            className: "btn",
            text: "Delete group",
            onclick: (e) => {
              if (
                !window.confirm(
                  "Delete this group? All its events will be removed.",
                )
              )
                return;
              return withBusy(e.target, async () => {
                try {
                  await deleteGroup(group.id);
                  window.location.hash = "#/app/groups";
                } catch (error) {
                  fail(error);
                }
              });
            },
          }),
        );
      } else {
        root.append(
          el("button", {
            type: "button",
            className: "btn",
            text: "Leave group",
            onclick: (e) => {
              if (!window.confirm("Leave this group?")) return;
              return withBusy(e.target, async () => {
                try {
                  await leaveGroup(group.id);
                  window.location.hash = "#/app/groups";
                } catch (error) {
                  fail(error);
                }
              });
            },
          }),
        );
      }

      els.groupDetail.replaceChildren(root);
    } catch (error) {
      els.groupDetail.replaceChildren(el("p", { text: error.message }));
    }
  }

  // Sub-router for #/app/groups*. Returns true when it renders detail mode.
  async function route(hash) {
    if (!hash.startsWith("#/app/groups")) return false;
    if (!canUseGroups()) {
      await refresh();
      return true;
    }
    const rest = hash.slice("#/app/groups".length);
    if (!rest || rest === "/") {
      showLists();
      await refresh();
      return true;
    }
    if (rest === "/new") {
      renderCreateForm();
      return true;
    }
    if (rest === "/join") {
      renderJoinForm("");
      return true;
    }
    const joinMatch = rest.match(/^\/join\/(.+)$/);
    if (joinMatch) {
      renderJoinForm(decodeURIComponent(joinMatch[1]));
      return true;
    }
    const newEventMatch = rest.match(/^\/([^/]+)\/events\/new$/);
    if (newEventMatch) {
      try {
        const detail = await getGroup(newEventMatch[1]);
        renderEventForm(detail.group);
      } catch (error) {
        showDetail();
        els.groupDetail.replaceChildren(el("p", { text: error.message }));
      }
      return true;
    }
    const detailMatch = rest.match(/^\/([^/]+)$/);
    if (detailMatch) {
      await renderDetail(detailMatch[1]);
      return true;
    }
    return false;
  }

  return { refresh, route, showLists };
}
