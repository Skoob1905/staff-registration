import { useAuth } from "../context/AuthProvider";
import { AgenciesButton } from "./ui/AgenciesButton";
import { DeleteButton } from "./ui/DeleteButton";
import { TagsButton } from "./ui/TagsButton";
import { UnassignButton } from "./ui/UnassignButton";

interface ActionButtonContainerProps {
  handleDelete?: () => void;
  handleUnassign?: () => void;
  handleTags?: () => void;
  handleAgencies?: () => void;
}

export const ActionButtonContainer = ({
  handleDelete,
  handleUnassign,
  handleTags,
  handleAgencies,
}: ActionButtonContainerProps) => {
  const { appUser } = useAuth();

  if (appUser?.role !== "super") return null;

  return (
    <div
      className="animate-cascade"
      style={{ animationDelay: "100ms" }}
    >
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        {handleAgencies && <AgenciesButton onClick={handleAgencies} />}
        {handleTags && <TagsButton onClick={handleTags} />}
        {handleUnassign && <UnassignButton onClick={handleUnassign} />}
        {handleDelete && <DeleteButton onClick={handleDelete} />}
      </div>
    </div>
  );
};
