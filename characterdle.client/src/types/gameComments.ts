export interface GameComment {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface GameCommentsPage {
  comments: GameComment[];
  page: number;
  hasNextPage: boolean;
}
