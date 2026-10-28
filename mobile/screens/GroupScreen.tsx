import { Pencil, Phone, Plus, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Primitives";
import type { GroupMember } from "@/lib/ride/group";
import { MemberEditor } from "../components/MemberEditor";
import { Sheet } from "../components/Sheet";
import { useSafety } from "../state";

export function GroupScreen() {
  const { t, members, deleteMember, showToast, session } = useSafety();
  const [editing, setEditing] = useState<GroupMember | "new" | null>(null);
  const [deleting, setDeleting] = useState<GroupMember | null>(null);

  return (
    <div className="m-screen">
      <header className="m-page-head">
        <div><h1>{t("group.title")}</h1><p>{t("group.subtitle")}</p></div>
        <button type="button" className="button button-primary button-sm" onClick={() => setEditing("new")}><Plus size={18} />{t("group.add")}</button>
      </header>

      {members.length === 0 ? (
        <div className="empty-state m-empty">
          <div className="empty-icon"><UsersRound size={26} /></div>
          <h3>{t("group.empty")}</h3>
          <p>{t("group.emptyText")}</p>
          <button type="button" className="button button-primary" onClick={() => setEditing("new")}><Plus size={18} />{t("group.add")}</button>
        </div>
      ) : (
        <ul className="m-members">
          {members.map((member) => (
            <li key={member.id} className="card m-member">
              <Avatar initials={member.initials} color={member.color} size="lg" />
              <div className="m-member-text">
                <strong>{member.name}</strong>
                <small>{member.relation}</small>
                <span><Phone size={12} />{member.phone}</span>
              </div>
              {session.sharing?.recipientIds.includes(member.id) && <span className="m-live-dot" title={t("contact.live")} />}
              <div className="m-member-actions">
                <button type="button" className="icon-button" onClick={() => setEditing(member)} aria-label={`${t("common.edit")} ${member.name}`}><Pencil size={17} /></button>
                <button type="button" className="icon-button" onClick={() => setDeleting(member)} aria-label={`${t("common.delete")} ${member.name}`}><Trash2 size={17} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MemberEditor member={editing} onClose={() => setEditing(null)} />
      <Sheet open={deleting !== null} title={t("common.delete")} onClose={() => setDeleting(null)} closeLabel={t("common.close")}>
        {deleting && (
          <div className="m-confirm-delete">
            <p>{t("group.deleteConfirm", { name: deleting.name })}</p>
            <div className="m-form-actions">
              <button type="button" className="button button-ghost" onClick={() => setDeleting(null)}>{t("common.cancel")}</button>
              <button type="button" className="button button-danger" onClick={() => { deleteMember(deleting.id); showToast(t("group.removed", { name: deleting.name })); setDeleting(null); }}>{t("common.delete")}</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
