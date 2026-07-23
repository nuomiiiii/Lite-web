import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, IconButton, Select, Theme } from "@radix-ui/themes";
import { Plus, Server, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import type { LiveDataResponse, Record as LiveRecord } from "@/types/LiveData";
import RemoteSession, { type RemoteNode } from "./RemoteSession";
import "./Terminal.css";

type RemoteTab = {
  id: string;
  uuid: string;
};

const maxTabs = 16;

export default function TerminalWorkspace() {
  const initialUUID = useMemo(() => new URLSearchParams(window.location.search).get("uuid"), []);
  const [nodes, setNodes] = useState<RemoteNode[]>([]);
  const [tabs, setTabs] = useState<RemoteTab[]>([]);
  const [activeID, setActiveID] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerUUID, setPickerUUID] = useState("");
  const [live, setLive] = useState<Record<string, LiveRecord>>({});
  const [online, setOnline] = useState<Set<string>>(new Set());
  const initialized = useRef(false);

  const addTab = useCallback((uuid: string) => {
    if (!uuid) return;
    setTabs((current) => {
      if (current.length >= maxTabs) {
        toast.error(`最多同时打开 ${maxTabs} 个远程标签`);
        return current;
      }
      const tab = { id: crypto.randomUUID(), uuid };
      setActiveID(tab.id);
      return [...current, tab];
    });
  }, []);

  useEffect(() => {
    fetch("/api/admin/client/list")
      .then((response) => response.json())
      .then((payload) => {
        const data = Array.isArray(payload) ? payload : payload?.data;
        const list = Array.isArray(data) ? data : [];
        setNodes(list);
        if (!initialized.current) {
          initialized.current = true;
          const requested = list.find((node: RemoteNode) => node.uuid === initialUUID && !node.remote_control_protected);
          const firstUUID = requested?.uuid || list.find((node: RemoteNode) => !node.remote_control_protected)?.uuid;
          if (firstUUID) addTab(firstUUID);
        }
      })
      .catch(() => toast.error("无法加载服务器列表"));
  }, [addTab, initialUUID]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/clients`);
    let interval: number | undefined;
    const request = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send("get");
    };
    ws.onopen = () => {
      request();
      interval = window.setInterval(request, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as LiveDataResponse;
        setLive(payload.data?.data || {});
        setOnline(new Set(payload.data?.online || []));
      } catch {
        // Ignore malformed live frames; the next poll replaces them.
      }
    };
    return () => {
      if (interval) window.clearInterval(interval);
      ws.close();
    };
  }, []);

  useEffect(() => {
    const active = tabs.find((tab) => tab.id === activeID);
    if (!active) return;
    const url = new URL(window.location.href);
    url.searchParams.set("uuid", active.uuid);
    window.history.replaceState(null, "", url);
    const node = nodes.find((item) => item.uuid === active.uuid);
    document.title = `${node?.name || "服务器"} - 远程终端`;
  }, [activeID, nodes, tabs]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.uuid, node])), [nodes]);
  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    return tabs.map((tab) => {
      const count = (counts.get(tab.uuid) || 0) + 1;
      counts.set(tab.uuid, count);
      const name = nodeMap.get(tab.uuid)?.name || tab.uuid.slice(0, 8);
      return count === 1 ? name : `${name} (${count})`;
    });
  }, [nodeMap, tabs]);

  const closeTab = (id: string) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (activeID === id) {
        const fallback = next[Math.min(index, next.length - 1)];
        setActiveID(fallback?.id || "");
      }
      return next;
    });
  };

  const openPicker = () => {
    setPickerUUID(
      nodes.find((node) => online.has(node.uuid) && !node.remote_control_protected)?.uuid ||
      nodes.find((node) => !node.remote_control_protected)?.uuid ||
      "",
    );
    setPickerOpen(true);
  };

  return (
    <Theme appearance="dark" accentColor="cyan" grayColor="slate" radius="small">
      <Toaster theme="dark" />
      <div className="remote-workspace">
        <nav className="remote-tabbar" aria-label="远程服务器标签">
          <div className="remote-brand"><Server size={17} /><span>Komari 远程管理</span></div>
          <div className="remote-tabs">
            {tabs.map((tab, index) => (
              <button key={tab.id} type="button" className={`remote-tab ${activeID === tab.id ? "is-active" : ""}`} onClick={() => setActiveID(tab.id)}>
                <i className={online.has(tab.uuid) ? "is-online" : ""} />
                <span title={labels[index]}>{labels[index]}</span>
                <IconButton asChild size="1" variant="ghost" color="gray">
                  <span role="button" tabIndex={0} title="关闭标签" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") { event.stopPropagation(); closeTab(tab.id); }
                  }}><X size={13} /></span>
                </IconButton>
              </button>
            ))}
          </div>
          <IconButton size="2" variant="ghost" title="打开服务器" onClick={openPicker}><Plus size={17} /></IconButton>
        </nav>

        <div className="remote-content">
          {tabs.map((tab) => {
            const node = nodeMap.get(tab.uuid) || { uuid: tab.uuid, name: tab.uuid.slice(0, 8) };
            return (
              <RemoteSession
                key={tab.id}
                node={node}
                live={live[tab.uuid]}
                online={online.has(tab.uuid)}
                active={activeID === tab.id}
                onDuplicate={() => addTab(tab.uuid)}
              />
            );
          })}
          {tabs.length === 0 && (
            <div className="remote-empty-workspace">
              <Server size={28} />
              <strong>尚未打开远程服务器</strong>
              <Button onClick={openPicker}><Plus size={15} />打开服务器</Button>
            </div>
          )}
        </div>
      </div>

      <Dialog.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>打开远程服务器</Dialog.Title>
          <Dialog.Description>可重复选择同一台服务器，每个标签都会建立独立的终端与文件会话。</Dialog.Description>
          <Select.Root value={pickerUUID} onValueChange={setPickerUUID}>
            <Select.Trigger className="w-full" placeholder="选择服务器" />
            <Select.Content>
              {nodes.map((node) => (
                <Select.Item key={node.uuid} value={node.uuid} disabled={node.remote_control_protected}>
                  {online.has(node.uuid) ? "●" : "○"} {node.name}{node.remote_control_protected ? " - Komari Server（已保护）" : ""}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <div className="remote-dialog-actions">
            <Button variant="soft" onClick={() => setPickerOpen(false)}>取消</Button>
            <Button disabled={!pickerUUID} onClick={() => { addTab(pickerUUID); setPickerOpen(false); }}>打开</Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </Theme>
  );
}
