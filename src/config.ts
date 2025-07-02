// 👇 constant value in all uppercase
export const FREE_QUOTA = {
  maxEventCategories: 1,
} as const

export const PRO_QUOTA = {
  maxEventCategories: Infinity,
} as const
