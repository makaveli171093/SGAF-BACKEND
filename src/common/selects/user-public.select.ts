export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
} as const;

export const publicUserSelectShort = {
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
} as const;
