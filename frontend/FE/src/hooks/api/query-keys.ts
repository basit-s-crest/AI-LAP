const usersRoot = ["users"] as const;
const coachesRoot = ["coaches"] as const;
const organizationsRoot = ["organizations"] as const;
const adminRoot = ["admin"] as const;

export const queryKeys = {
  users: {
    all: usersRoot,
    list: () => [...usersRoot, "list"] as const,
    detail: (id: string) => [...usersRoot, "detail", id] as const,
  },
  coaches: {
    all: coachesRoot,
    list: () => [...coachesRoot, "list"] as const,
    detail: (id: string) => [...coachesRoot, "detail", id] as const,
  },
  organizations: {
    all: organizationsRoot,
    list: () => [...organizationsRoot, "list"] as const,
    detail: (id: string | number) => [...organizationsRoot, "detail", id] as const,
  },
  admin: {
    all: adminRoot,
    groups: () => [...adminRoot, "groups"] as const,
    activity: () => [...adminRoot, "activity"] as const,
    moodDistribution: () => [...adminRoot, "mood-distribution"] as const,
  },
} as const;
