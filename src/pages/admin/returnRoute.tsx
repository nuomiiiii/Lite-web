import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Flex,
  IconButton,
  Select,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  History,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Route,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Loading from "@/components/loading";
import {
  NodeDetailsProvider,
  useNodeDetails,
} from "@/contexts/NodeDetailsContext";

type Task = {
  id?: number;
  name: string;
  client: string;
  client_info?: { name?: string };
  carrier: "mobile" | "telecom" | "unicom";
  region: string;
  target: string;
  ip_version: number;
  expected_line: string;
  protocol: string;
  interval: number;
  switch_confirm: number;
  recovery_confirm: number;
  cooldown: number;
  notify: boolean;
  enabled: boolean;
};

type Status = {
  task_id: number;
  current_line?: string;
  state: "pending" | "observing" | "healthy" | "switched" | "unknown";
  confidence: number;
  asn_path?: string[];
  route_path?: string[];
  candidate_line?: string;
  candidate_count?: number;
  last_error?: string;
  last_checked_at?: string;
};

type RouteEvent = {
  id: number;
  task_id: number;
  client: string;
  kind: "switch" | "recovery";
  from_line: string;
  to_line: string;
  confidence: number;
  asn_path?: string[];
  occurred_at: string;
};

type Overview = { tasks: Task[]; statuses: Status[]; events: RouteEvent[] };

const defaults: Task = {
  name: "",
  client: "",
  carrier: "mobile",
  region: "华东",
  target: "",
  ip_version: 4,
  expected_line: "CMIN2",
  protocol: "icmp",
  interval: 180,
  switch_confirm: 2,
  recovery_confirm: 3,
  cooldown: 1800,
  notify: true,
  enabled: true,
};

const lineOptions: Record<Task["carrier"], string[]> = {
  mobile: ["CMIN2", "CMI", "CMNET"],
  telecom: ["CN2 GIA", "CN2 GT", "163"],
  unicom: ["9929", "4837"],
};

const allLineOptions = Object.values(lineOptions).flat();

const carrierNames: Record<Task["carrier"], string> = {
  mobile: "中国移动",
  telecom: "中国电信",
  unicom: "中国联通",
};

async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/admin/return-route${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status === "error") {
    throw new Error(payload?.message || payload?.error?.message || "请求失败");
  }
  return payload?.data ?? payload;
}

function stateBadge(status?: Status) {
  if (!status) return <Badge color="gray">等待首次探测</Badge>;
  const states = {
    pending: { color: "gray" as const, text: "等待首次探测" },
    observing: { color: "amber" as const, text: "确认中" },
    healthy: { color: "green" as const, text: "线路正常" },
    switched: { color: "red" as const, text: "已切线" },
    unknown: { color: "gray" as const, text: "暂时无法识别" },
  };
  const item = states[status.state] || states.unknown;
  return <Badge color={item.color}>{item.text}</Badge>;
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { hour12: false });
}

function RouteTaskDialog({
  task,
  nodes,
  onSaved,
  children,
}: {
  task?: Task;
  nodes: Array<{ uuid: string; name: string }>;
  onSaved: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Task>({ ...defaults, ...task });

  useEffect(() => setForm({ ...defaults, ...task }), [task, open]);

  const setCarrier = (carrier: Task["carrier"]) => {
    setForm((current) => ({
      ...current,
      carrier,
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await request(task?.id ? "/edit" : "/add", form);
      if (task?.id) {
        toast.success("任务已更新");
      } else if (result?.dispatched) {
        toast.success("任务已创建，首次探测已下发，通常 30 秒内返回");
      } else {
        toast.success("任务已创建，将在节点连接后按周期探测");
      }
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{children}</Dialog.Trigger>
      <Dialog.Content maxWidth="680px">
        <Dialog.Title>{task?.id ? "编辑回程监测" : "新建回程监测"}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          从所选服务器探测到国内目标的逐跳路径，并在线路变化稳定后通知。
        </Dialog.Description>
        <form onSubmit={submit}>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="任务名称">
              <TextField.Root required value={form.name} placeholder="例如：东京到上海移动" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="探测节点">
              <Select.Root value={form.client || undefined} onValueChange={(client) => setForm({ ...form, client })}>
                <Select.Trigger placeholder="选择服务器" className="w-full" />
                <Select.Content>{nodes.map((node) => <Select.Item key={node.uuid} value={node.uuid}>{node.name || node.uuid}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Field>
            <Field label="运营商">
              <Select.Root value={form.carrier} onValueChange={(value) => setCarrier(value as Task["carrier"])}>
                <Select.Trigger className="w-full" />
                <Select.Content>{Object.entries(carrierNames).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Field>
            <Field label="地区">
              <TextField.Root required value={form.region} placeholder="例如：华东 / 上海" onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </Field>
            <Field label="目标 IP 或域名">
              <TextField.Root required value={form.target} placeholder="运营商测试目标" onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </Field>
            <Field label="地址类型">
              <Select.Root value={String(form.ip_version)} onValueChange={(value) => setForm({ ...form, ip_version: Number(value) })}>
                <Select.Trigger className="w-full" />
                <Select.Content><Select.Item value="4">IPv4</Select.Item><Select.Item value="6">IPv6</Select.Item></Select.Content>
              </Select.Root>
            </Field>
            <Field label="预期线路">
              <Select.Root value={form.expected_line} onValueChange={(expected_line) => setForm({ ...form, expected_line })}>
                <Select.Trigger className="w-full" />
                <Select.Content>{allLineOptions.map((line) => <Select.Item key={line} value={line}>{line}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Field>
            <Field label="探测协议">
              <Select.Root value="icmp" disabled><Select.Trigger className="w-full" /><Select.Content><Select.Item value="icmp">内置 ICMP（推荐）</Select.Item></Select.Content></Select.Root>
            </Field>
            <Field label="探测间隔（秒）">
              <TextField.Root type="number" min="60" max="86400" value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })} />
            </Field>
            <Field label="切线确认次数">
              <TextField.Root type="number" min="1" max="20" value={form.switch_confirm} onChange={(e) => setForm({ ...form, switch_confirm: Number(e.target.value) })} />
            </Field>
            <Field label="恢复确认次数">
              <TextField.Root type="number" min="1" max="20" value={form.recovery_confirm} onChange={(e) => setForm({ ...form, recovery_confirm: Number(e.target.value) })} />
            </Field>
            <Field label="重复通知间隔（秒）">
              <TextField.Root type="number" min="0" max="604800" value={form.cooldown} onChange={(e) => setForm({ ...form, cooldown: Number(e.target.value) })} />
            </Field>
            <Field label="通知渠道">
              <Select.Root value="default" disabled><Select.Trigger className="w-full" /><Select.Content><Select.Item value="default">系统默认通知渠道</Select.Item></Select.Content></Select.Root>
            </Field>
            <div className="flex flex-col justify-end gap-3 pb-1">
              <label className="flex items-center justify-between gap-3 text-sm"><span>发送切线与恢复通知</span><Switch checked={form.notify} onCheckedChange={(notify) => setForm({ ...form, notify })} /></label>
              <label className="flex items-center justify-between gap-3 text-sm"><span>启用任务</span><Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} /></label>
            </div>
          </div>
          <Flex justify="end" gap="3" mt="6">
            <Dialog.Close><Button type="button" variant="soft" color="gray">取消</Button></Dialog.Close>
            <Button type="submit" loading={saving}>保存</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5"><Text size="2" weight="medium">{label}</Text>{children}</label>;
}

function ReturnRouteContent() {
  const { nodeDetail, isLoading: nodesLoading } = useNodeDetails();
  const nodes = Array.isArray(nodeDetail) ? nodeDetail.map((node) => ({ uuid: node.uuid, name: node.name })) : [];
  const [overview, setOverview] = useState<Overview>({ tasks: [], statuses: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [probingTasks, setProbingTasks] = useState<Set<number>>(new Set());

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await request("/");
      setOverview({ tasks: data?.tasks || [], statuses: data?.statuses || [], events: data?.events || [] });
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const statuses = useMemo(() => new Map(overview.statuses.map((item) => [item.task_id, item])), [overview.statuses]);
  const tasks = useMemo(() => new Map(overview.tasks.map((item) => [item.id, item])), [overview.tasks]);
  const healthy = overview.tasks.filter((task) => statuses.get(task.id || 0)?.state === "healthy").length;
  const switched = overview.tasks.filter((task) => statuses.get(task.id || 0)?.state === "switched").length;

  const runNow = async (id?: number) => {
    if (!id) return;
    try {
      await request("/probe", { id });
      setProbingTasks((current) => new Set(current).add(id));
      toast.success("探测任务已下发，逐跳探测通常需要 10-30 秒");
      setTimeout(() => refresh(true), 1500);
      window.setTimeout(() => {
        setProbingTasks((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, 45000);
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "下发失败"); }
  };
  const remove = async (task: Task) => {
    if (!task.id || !window.confirm(`确定删除“${task.name}”及其切换历史吗？`)) return;
    try { await request("/delete", { ids: [task.id] }); toast.success("任务已删除"); refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
  };

  if (loading || nodesLoading) return <Loading text="" />;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-2 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-xl font-semibold">回程线路监测</h1><p className="mt-1 text-sm text-gray-500">识别移动、电信、联通回程线路，确认切线后告警，恢复后自动通知。</p></div>
        <Flex gap="2">
          <IconButton variant="soft" color="gray" title="刷新" onClick={() => refresh()}><RefreshCw size={16} /></IconButton>
          <RouteTaskDialog nodes={nodes} onSaved={() => refresh()}><Button><Plus size={16} />新建任务</Button></RouteTaskDialog>
        </Flex>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="监测任务" value={overview.tasks.length} icon={<Route size={18} />} />
        <Summary label="线路正常" value={healthy} tone="green" icon={<CheckCircle2 size={18} />} />
        <Summary label="已确认切线" value={switched} tone="red" icon={<AlertTriangle size={18} />} />
        <Summary label="最近事件" value={overview.events.length} icon={<History size={18} />} />
      </div>

      {overview.tasks.length === 0 ? (
        <Callout.Root color="gray"><Callout.Icon><Activity size={16} /></Callout.Icon><Callout.Text>暂无任务。新建任务后，2.1.11 Agent 会直接执行内置逐跳探测。</Callout.Text></Callout.Root>
      ) : (
        <section className="overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900"><tr><th className="p-3">任务 / 节点</th><th className="p-3">运营商 / 地区</th><th className="p-3">线路</th><th className="p-3">状态</th><th className="p-3">关键 ASN</th><th className="p-3">最后探测</th><th className="p-3 text-right">操作</th></tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {overview.tasks.map((task) => {
                  const status = statuses.get(task.id || 0);
                  const needed = status?.candidate_line === task.expected_line ? task.recovery_confirm : task.switch_confirm;
                  return <tr key={task.id} className="align-top hover:bg-gray-50/60 dark:hover:bg-gray-900/50">
                    <td className="p-3"><div className="font-medium">{task.name}</div><div className="mt-1 text-xs text-gray-500">{task.client_info?.name || task.client}</div></td>
                    <td className="p-3"><div>{carrierNames[task.carrier]}</div><div className="mt-1 text-xs text-gray-500">{task.region} · IPv{task.ip_version}</div></td>
                    <td className="p-3"><div><span className="text-gray-500">当前 </span><strong>{status?.current_line || "-"}</strong></div><div className="mt-1 text-xs text-gray-500">预期 {task.expected_line}</div></td>
                    <td className="p-3">{probingTasks.has(task.id || 0) ? <Badge color="blue"><RefreshCw size={12} className="mr-1 animate-spin" />探测中</Badge> : stateBadge(status)}{status?.candidate_line && <div className="mt-1 text-xs text-amber-600">{status.candidate_line} {status.candidate_count}/{needed}</div>}{(status?.confidence ?? 0) > 0 && <div className="mt-1 text-xs text-gray-500">置信度 {((status?.confidence ?? 0) * 100).toFixed(0)}%</div>}</td>
                    <td className="max-w-[280px] p-3"><div className="flex flex-wrap gap-1">{status?.asn_path?.length ? status.asn_path.map((asn) => <Badge key={asn} color="gray" variant="soft">{asn}</Badge>) : <span className="text-gray-400">-</span>}</div>{status?.route_path?.length ? <details className="mt-2 text-xs text-gray-500"><summary className="cursor-pointer">查看完整路径</summary><div className="mt-2 max-h-48 overflow-auto whitespace-pre font-mono leading-5">{status?.route_path?.join("\n")}</div></details> : null}{status?.last_error && <div className="mt-2 max-w-xs text-xs text-red-600">{status.last_error}</div>}</td>
                    <td className="p-3 text-gray-600">{formatTime(status?.last_checked_at)}<div className="mt-1 text-xs text-gray-400">每 {Math.round(task.interval / 60)} 分钟</div></td>
                    <td className="p-3"><Flex justify="end" gap="1"><IconButton variant="ghost" title={probingTasks.has(task.id || 0) ? "探测中" : "立即探测"} disabled={probingTasks.has(task.id || 0)} onClick={() => runNow(task.id)}>{probingTasks.has(task.id || 0) ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}</IconButton><RouteTaskDialog task={task} nodes={nodes} onSaved={() => refresh()}><IconButton variant="ghost" title="编辑"><Pencil size={16} /></IconButton></RouteTaskDialog><IconButton variant="ghost" color="red" title="删除" onClick={() => remove(task)}><Trash2 size={16} /></IconButton></Flex></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2"><History size={17} /><h2 className="text-base font-semibold">切换与恢复记录</h2></div>
        <div className="overflow-hidden border border-gray-200 dark:border-gray-800">
          {overview.events.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">暂无已确认的线路变化</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900"><tr><th className="p-3">时间</th><th className="p-3">任务</th><th className="p-3">类型</th><th className="p-3">线路变化</th><th className="p-3">关键 ASN</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{overview.events.map((event) => <tr key={event.id}><td className="p-3">{formatTime(event.occurred_at)}</td><td className="p-3">{tasks.get(event.task_id)?.name || `#${event.task_id}`}</td><td className="p-3"><Badge color={event.kind === "recovery" ? "green" : "red"}>{event.kind === "recovery" ? "恢复" : "切线"}</Badge></td><td className="p-3"><span>{event.from_line || "-"}</span><span className="px-2 text-gray-400">→</span><strong>{event.to_line}</strong></td><td className="p-3 text-xs text-gray-500">{event.asn_path?.join(" → ") || "-"}</td></tr>)}</tbody></table></div>}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, icon, tone = "gray" }: { label: string; value: number; icon: React.ReactNode; tone?: "gray" | "green" | "red" }) {
  const color = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "text-gray-500";
  return <div className="flex min-h-20 items-center justify-between border border-gray-200 px-4 py-3 dark:border-gray-800"><div><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div><span className={color}>{icon}</span></div>;
}

export default function ReturnRoutePage() {
  return <NodeDetailsProvider><ReturnRouteContent /></NodeDetailsProvider>;
}
