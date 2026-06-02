export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // página actual (0-based)
  size: number;
  first: boolean;
  last: boolean;
}
