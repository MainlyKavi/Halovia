export interface GroupMember {
  id: string;
  name: string;
  phone: string;
  relation: string;
  initials: string;
  color: string;
  /** Pre-selected when a new ride is shared. */
  shareByDefault?: boolean;
}

export const MEMBER_COLORS = ["#ce6685", "#6f63d9", "#23866d", "#b66c27", "#3d7fb8"] as const;

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) return "?";
  const letters = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : [Array.from(parts[0])[0], Array.from(parts[parts.length - 1])[0]];
  return letters.join("").toLocaleUpperCase();
}

export type MemberError = "nameRequired" | "phoneInvalid";

export function validateMember(input: Pick<GroupMember, "name" | "phone">): MemberError[] {
  const errors: MemberError[] = [];
  if (!input.name.trim()) errors.push("nameRequired");
  const digits = input.phone.replace(/\D/gu, "");
  if (digits.length < 7 || digits.length > 15 || /[^\d\s+()-]/u.test(input.phone)) errors.push("phoneInvalid");
  return errors;
}

export function upsertMember(members: readonly GroupMember[], member: GroupMember): GroupMember[] {
  const normalized: GroupMember = { ...member, name: member.name.trim(), phone: member.phone.trim(), relation: member.relation.trim(), initials: initialsFor(member.name) };
  return members.some((item) => item.id === member.id)
    ? members.map((item) => (item.id === member.id ? normalized : item))
    : [...members, normalized];
}

export function removeMember(members: readonly GroupMember[], id: string): GroupMember[] {
  return members.filter((item) => item.id !== id);
}

/** Keeps a per-journey selection valid after members are added or removed. */
export function reconcileSelection(selection: readonly string[], members: readonly GroupMember[]): string[] {
  const ids = new Set(members.map((member) => member.id));
  return selection.filter((id) => ids.has(id));
}

export function toggleSelection(selection: readonly string[], id: string): string[] {
  return selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id];
}

/** Ids of the members a new share starts with: the default ones, or everyone if none are marked. */
export function defaultRecipients(members: readonly GroupMember[]): string[] {
  const marked = members.filter((member) => member.shareByDefault);
  return (marked.length ? marked : members).map((member) => member.id);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? "";
}

/**
 * Short list of who is following a journey: "Dad", "Dad & Kavi", or
 * "Dad, Kavi +2" when more than two people are viewing. Templates come from
 * the translated strings so the joiner can be localized.
 */
export function summarizeViewers(names: readonly string[], templates: { pair: string; more: string }): string {
  const first = names.map(firstName).filter(Boolean);
  if (first.length <= 1) return first[0] ?? "";
  if (first.length === 2) return templates.pair.replace("{a}", first[0]).replace("{b}", first[1]);
  return templates.more.replace("{a}", first[0]).replace("{b}", first[1]).replace("{count}", String(first.length - 2));
}

export const DEMO_MEMBERS: GroupMember[] = [
  { id: "member-dad", name: "Dad", phone: "+91 90000 00001", relation: "Father", initials: "DA", color: MEMBER_COLORS[0], shareByDefault: true },
  { id: "member-kavi", name: "Kavi Goutam", phone: "+91 90000 00002", relation: "Brother", initials: "KG", color: MEMBER_COLORS[1], shareByDefault: true },
  { id: "member-niara", name: "Niara", phone: "+91 90000 00003", relation: "Best friend", initials: "NI", color: MEMBER_COLORS[2], shareByDefault: true },
  { id: "member-milan", name: "Milan", phone: "+91 90000 00004", relation: "Cousin", initials: "MI", color: MEMBER_COLORS[3] },
];
