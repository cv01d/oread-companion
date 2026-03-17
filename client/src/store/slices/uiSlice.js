export const createUISlice = (set) => ({
  currentPage: 'chat',

  setCurrentPage: (page) => set({ currentPage: page }),
});
