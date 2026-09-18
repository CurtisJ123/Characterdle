export interface Announcement {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  status: 'draft' | 'published';
  showPopup: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AnnouncementPage<T> { items: T[]; page: number; hasNextPage: boolean }
export interface AnnouncementComment {
  id: string;
  announcementId: string;
  postTitle: string;
  postSlug: string;
  displayName: string;
  avatarUrl: string | null;
  showSupporterBadge: boolean;
  body: string;
  createdAt: string;
  isOwn: boolean;
  isHidden: boolean;
}
export interface LatestAnnouncement { post: Announcement | null; seen: boolean }
