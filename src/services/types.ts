export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

export const createSuccess = <T>(data: T): Result<T> => ({
  success: true,
  data
});

export const createError = <E extends Error = Error>(error: E | string): Result<any, Error> => ({
  success: false,
  error: typeof error === 'string' ? new Error(error) : error
});
