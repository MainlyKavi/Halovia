export interface GroupMember {
  id: string;
  name: string;
  phone: string;
  relation: string;
  initials: string;
  color: string;
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
  const normalized = { ...member, name: member.name.trim(), phone: member.phone.trim(), relation: member.relation.trim(), initials: initialsFor(member.name) };
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

export const DEMO_MEMBERS: GroupMember[] = [
  { id: "member-amma", name: "Lakshmi Iyer", phone: "+91 90000 00001", relation: "Mother", initials: "LI", color: MEMBER_COLORS[0] },
  { id: "member-priya", name: "Priya Sharma", phone: "+91 90000 00002", relation: "Best friend", initials: "PS", color: MEMBER_COLORS[1] },
  { id: "member-arjun", name: "Arjun Iyer", phone: "+91 90000 00003", relation: "Brother", initials: "AI", color: MEMBER_COLORS[2] },
];
