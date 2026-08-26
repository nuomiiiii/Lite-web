import { useMemo } from "react";
import { Callout } from "@/components/admin/ui";
import { CircleAlert } from "@/components/admin/muiIcons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import AdminPageTitle from "@/components/admin/AdminPageTitle";
import Loading from "@/components/loading";
import RemoteNodePicker from "@/components/remote/RemoteNodePicker";
import { useNodeList } from "@/contexts/NodeListContext";
import { useAdminNodeLiveData } from "@/hooks/use-admin-node-live-data";
import { openRemoteTerminal } from "@/utils/remoteLaunch";

export default function AdminRemoteTerminal() {
  const { t } = useTranslation();
  const { nodeList, isLoading, error } = useNodeList();
  const { liveData, available } = useAdminNodeLiveData();
  const online = useMemo(
    () => new Set(liveData?.data.online ?? []),
    [liveData?.data.online],
  );
  const nodes = useMemo(() => nodeList ?? [], [nodeList]);

  if (isLoading) return <Loading />;

  return (
    <div className="flex w-full flex-col gap-4 p-0 md:p-4">
      <AdminPageTitle description={t("terminal.portal_subtitle")}>
        {t("terminal.remote_title")}
      </AdminPageTitle>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Icon><CircleAlert size={16} /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <RemoteNodePicker
        nodes={nodes}
        onlineSet={online}
        available={available}
        rowsPerPage={3}
        onSelect={(node) => {
          if (!openRemoteTerminal(node.uuid)) toast.error("浏览器阻止了远程管理窗口");
        }}
      />
    </div>
  );
}
