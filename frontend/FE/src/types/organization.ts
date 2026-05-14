export interface Organization {
  /** Cuid from API or legacy numeric id from mocks */
  id: string | number;
  name: string;
  type: string;
  plan: string;
  users: number;
  active: number;
  coaches: number;
  spend: string;
  contact: string;
}
