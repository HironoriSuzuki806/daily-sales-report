export interface CommentResponse {
  id: number;
  commenter: { id: number; name: string };
  content: string;
  createdAt: string;
}

export async function listComments(
  _dailyReportId: number,
  _requesterId: number,
  _role: string,
  _departmentId: number | null
): Promise<CommentResponse[]> {
  throw new Error('Not implemented');
}

export async function createComment(
  _dailyReportId: number,
  _commenterId: number,
  _content: string
): Promise<CommentResponse> {
  throw new Error('Not implemented');
}
