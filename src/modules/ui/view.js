export function createView() {
  let state = {
    query: "",
    status: "all",
    sort: "date",
    tag: null,
  };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
