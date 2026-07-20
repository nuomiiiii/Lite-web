import Loading from "@/components/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NodeDetailsProvider,
  useNodeDetails,
} from "@/contexts/NodeDetailsContext";
import {
  PingTaskProvider,
  usePingTask,
  type PingTask,
} from "@/contexts/PingTaskContext";
import {
  Badge,
  Button,
  Dialog,
  Flex,
  IconButton,
  Select,
  Switch,
  TextField,
} from "@radix-ui/themes";
import { Pencil, Plus, Trash2 } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type PingLossNotification = {
  id: number;
  client: string;
  task_id: number;
  enable: boolean;
  window_seconds: number;
  loss_threshold: number;
  minimum_samples: number;
  cooldown_seconds: number;
  last_notified?: string | null;
  task?: PingTask;
};

type FormState = {
  enable: boolean;
  client: string;
  taskId: number;
  windowMinutes: number;
  lossThreshold: number;
  minimumSamples: number;
  cooldownMinutes: number;
};

const defaultForm: FormState = {
  enable: true,
  client: "",
  taskId: 0,
  windowMinutes: 1,
  lossThreshold: 5,
  minimumSamples: 1,
  cooldownMinutes: 5,
};

const parseResponse = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data;
};

const tasksForClient = (tasks: PingTask[], client: string) =>
  tasks.filter(
    (task) =>
      typeof task.id === "number" && (task.clients || []).includes(client),
  );

const PingLossPage = () => (
  <PingTaskProvider>
    <NodeDetailsProvider>
      <PingLossContent />
    </NodeDetailsProvider>
  </PingTaskProvider>
);

const PingLossContent = () => {
  const { t } = useTranslation();
  const { nodeDetail, isLoading: nodesLoading, error: nodesError } =
    useNodeDetails();
  const { pingTasks, isLoading: tasksLoading, error: tasksError } =
    usePingTask();
  const [rules, setRules] = React.useState<PingLossNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/notification/ping-loss/");
      const data = await parseResponse(response);
      setRules(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || nodesLoading || tasksLoading) {
    return <Loading text={t("loading")} />;
  }
  if (error || nodesError || tasksError) {
    return <div>{t("common.error")}: {error || nodesError || tasksError}</div>;
  }

  const tasks = pingTasks || [];
  const nodeName = (uuid: string) =>
    nodeDetail.find((node) => node.uuid === uuid)?.name || uuid;
  const taskInfo = (rule: PingLossNotification) =>
    tasks.find((task) => task.id === rule.task_id) || rule.task;

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 p-1 md:p-4">
      <Flex className="w-full" justify="between" align="center" gap="3" wrap="wrap">
        <label className="text-2xl font-semibold">
          {t("notification.ping_loss.full_title")}
        </label>
        <RuleDialog tasks={tasks} onSaved={refresh}>
          <Button
            aria-label={t("common.add")}
            title={t("common.add")}
            className="shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t("common.add")}</span>
          </Button>
        </RuleDialog>
      </Flex>

      <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.server")}</TableHead>
              <TableHead>{t("ping.task")}</TableHead>
              <TableHead>{t("ping.target")}</TableHead>
              <TableHead>{t("notification.ping_loss.window")}</TableHead>
              <TableHead>{t("notification.ping_loss.threshold")}</TableHead>
              <TableHead>{t("notification.ping_loss.minimum_samples")}</TableHead>
              <TableHead>{t("notification.ping_loss.cooldown")}</TableHead>
              <TableHead>{t("notification.ping_loss.last_notified")}</TableHead>
              <TableHead>{t("common.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                  {t("notification.ping_loss.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const task = taskInfo(rule);
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge color={rule.enable ? "green" : "gray"}>
                        {rule.enable
                          ? t("common.enabled")
                          : t("common.disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell>{nodeName(rule.client)}</TableCell>
                    <TableCell>{task?.name || `#${rule.task_id}`}</TableCell>
                    <TableCell>{task?.target || "-"}</TableCell>
                    <TableCell>
                      {t("notification.ping_loss.minutes", {
                        count: rule.window_seconds / 60,
                      })}
                    </TableCell>
                    <TableCell>{rule.loss_threshold.toFixed(1)}%</TableCell>
                    <TableCell>{rule.minimum_samples}</TableCell>
                    <TableCell>
                      {t("notification.ping_loss.minutes", {
                        count: rule.cooldown_seconds / 60,
                      })}
                    </TableCell>
                    <TableCell>
                      {rule.last_notified
                        ? new Date(rule.last_notified).toLocaleString()
                        : t("notification.ping_loss.never")}
                    </TableCell>
                    <TableCell>
                      <Flex gap="2" align="center">
                        <RuleDialog rule={rule} tasks={tasks} onSaved={refresh}>
                          <IconButton
                            variant="ghost"
                            title={t("common.edit")}
                            aria-label={t("common.edit")}
                          >
                            <Pencil size={16} />
                          </IconButton>
                        </RuleDialog>
                        <DeleteRuleButton rule={rule} onDeleted={refresh} />
                      </Flex>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const RuleDialog = ({
  children,
  rule,
  tasks,
  onSaved,
}: {
  children: React.ReactNode;
  rule?: PingLossNotification;
  tasks: PingTask[];
  onSaved: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const { nodeDetail } = useNodeDetails();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(defaultForm);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      rule
        ? {
            enable: rule.enable,
            client: rule.client,
            taskId: rule.task_id,
            windowMinutes: rule.window_seconds / 60,
            lossThreshold: rule.loss_threshold,
            minimumSamples: rule.minimum_samples,
            cooldownMinutes: rule.cooldown_seconds / 60,
          }
        : defaultForm,
    );
  }, [open, rule]);

  const availableTasks = tasksForClient(tasks, form.client);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.client ||
      form.taskId <= 0 ||
      form.windowMinutes < 1 ||
      form.lossThreshold <= 0 ||
      form.lossThreshold > 100 ||
      form.minimumSamples < 1 ||
      form.cooldownMinutes < 1
    ) {
      toast.error(t("notification.ping_loss.invalid_form"));
      return;
    }

    const payload = {
      ...(rule ? { id: rule.id } : {}),
      client: form.client,
      task_id: form.taskId,
      enable: form.enable,
      window_seconds: Math.round(form.windowMinutes * 60),
      loss_threshold: form.lossThreshold,
      minimum_samples: Math.round(form.minimumSamples),
      cooldown_seconds: Math.round(form.cooldownMinutes * 60),
    };

    setSaving(true);
    try {
      const response = await fetch(
        rule
          ? "/api/admin/notification/ping-loss/edit"
          : "/api/admin/notification/ping-loss/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            rule ? { notifications: [payload] } : payload,
          ),
        },
      );
      await parseResponse(response);
      toast.success(t("common.updated_successfully"));
      setOpen(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{children}</Dialog.Trigger>
      <Dialog.Content maxWidth="560px" aria-describedby={undefined}>
        <Dialog.Title>
          {rule
            ? t("notification.ping_loss.edit")
            : t("notification.ping_loss.add")}
        </Dialog.Title>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <Flex justify="between" align="center">
            <label htmlFor="ping-loss-enable">{t("common.status")}</label>
            <Switch
              id="ping-loss-enable"
              checked={form.enable}
              onCheckedChange={(enable) =>
                setForm((current) => ({ ...current, enable }))
              }
            />
          </Flex>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("common.server")}>
              <Select.Root
                value={form.client}
                onValueChange={(client) => {
                  const nextTasks = tasksForClient(tasks, client);
                  setForm((current) => ({
                    ...current,
                    client,
                    taskId: nextTasks[0]?.id || 0,
                  }));
                }}
              >
                <Select.Trigger placeholder={t("common.select")} />
                <Select.Content>
                  {nodeDetail.map((node) => (
                    <Select.Item key={node.uuid} value={node.uuid}>
                      {node.name || node.uuid}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>

            <Field label={t("ping.task")}>
              <Select.Root
                value={form.taskId > 0 ? String(form.taskId) : ""}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    taskId: Number(value),
                  }))
                }
                disabled={!form.client || availableTasks.length === 0}
              >
                <Select.Trigger placeholder={t("common.select")} />
                <Select.Content>
                  {availableTasks.map((task) => (
                    <Select.Item key={task.id} value={String(task.id)}>
                      {task.name || `#${task.id}`}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>

            <NumberField
              label={t("notification.ping_loss.window_minutes")}
              value={form.windowMinutes}
              min={1}
              max={1440}
              onChange={(windowMinutes) =>
                setForm((current) => ({ ...current, windowMinutes }))
              }
            />
            <NumberField
              label={t("notification.ping_loss.threshold") + " (%)"}
              value={form.lossThreshold}
              min={0.1}
              max={100}
              step={0.1}
              onChange={(lossThreshold) =>
                setForm((current) => ({ ...current, lossThreshold }))
              }
            />
            <NumberField
              label={t("notification.ping_loss.minimum_samples")}
              value={form.minimumSamples}
              min={1}
              max={100000}
              onChange={(minimumSamples) =>
                setForm((current) => ({ ...current, minimumSamples }))
              }
            />
            <NumberField
              label={t("notification.ping_loss.cooldown_minutes")}
              value={form.cooldownMinutes}
              min={1}
              max={10080}
              onChange={(cooldownMinutes) =>
                setForm((current) => ({ ...current, cooldownMinutes }))
              }
            />
          </div>

          <Flex gap="2" justify="end" className="mt-2">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray">
                {t("common.cancel")}
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex min-w-0 flex-col gap-2">
    <span>{label}</span>
    {children}
  </label>
);

const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) => (
  <Field label={label}>
    <TextField.Root
      type="number"
      value={String(value)}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </Field>
);

const DeleteRuleButton = ({
  rule,
  onDeleted,
}: {
  rule: PingLossNotification;
  onDeleted: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      const response = await fetch(
        "/api/admin/notification/ping-loss/delete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: [rule.id] }),
        },
      );
      await parseResponse(response);
      toast.success(t("common.deleted_successfully"));
      setOpen(false);
      await onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton
          variant="ghost"
          color="red"
          title={t("common.delete")}
          aria-label={t("common.delete")}
        >
          <Trash2 size={16} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="420px" aria-describedby={undefined}>
        <Dialog.Title>{t("notification.ping_loss.delete_title")}</Dialog.Title>
        <Flex gap="2" justify="end" className="mt-6">
          <Dialog.Close>
            <Button type="button" variant="soft" color="gray">
              {t("common.cancel")}
            </Button>
          </Dialog.Close>
          <Button color="red" onClick={remove} disabled={deleting}>
            {t("common.delete")}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default PingLossPage;
