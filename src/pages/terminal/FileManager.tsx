import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Download,
  File as FileIcon,
  FilePlus2,
  Folder,
  FolderPlus,
  HardDrive,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Dialog, IconButton, TextField } from "@radix-ui/themes";
import { toast } from "sonner";
import { formatBytes } from "@/utils/unitHelper";

export type FileEntry = {
  name: string;
  path: string;
  size: number;
  mode: string;
  modified_at: string;
  directory: boolean;
  symlink: boolean;
  hidden: boolean;
  protected: boolean;
};

type FileResponse = {
  type: string;
  id: string;
  operation?: string;
  ok?: boolean;
  error?: string;
  data?: any;
  name?: string;
  size?: number;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timeout: number;
};

type DownloadState = {
  name: string;
  size: number;
  received: number;
  chunks: Uint8Array[];
};

export type FileManagerHandle = {
  handleMessage: (message: FileResponse) => void;
  initialize: (roots: string[], home: string, separator: string) => void;
  refresh: () => void;
};

type Props = {
  send: (message: Record<string, unknown>) => boolean;
  connected: boolean;
};

const requestTimeout = 30_000;
const uploadChunkSize = 256 * 1024;

function joinRemotePath(base: string, name: string, separator: string) {
  if (!base) return name;
  if (base.endsWith(separator)) return `${base}${name}`;
  return `${base}${separator}${name}`;
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

const FileManager = forwardRef<FileManagerHandle, Props>(({ send, connected }, ref) => {
  const pending = useRef(new Map<string, PendingRequest>());
  const downloads = useRef(new Map<string, DownloadState>());
  const [roots, setRoots] = useState<string[]>([]);
  const [separator, setSeparator] = useState("/");
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [createKind, setCreateKind] = useState<"file" | "folder" | null>(null);
  const [createName, setCreateName] = useState("");
  const [renameEntry, setRenameEntry] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferLabel, setTransferLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const request = (type: string, payload: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    return new Promise<any>((resolve, reject) => {
      if (!send({ type, id, ...payload })) {
        reject(new Error("远程连接尚未就绪"));
        return;
      }
      const timeout = window.setTimeout(() => {
        const waiting = pending.current.get(id);
        if (waiting) {
          pending.current.delete(id);
          waiting.reject(new Error("文件操作超时"));
        }
      }, requestTimeout);
      pending.current.set(id, { resolve, reject, timeout });
    });
  };

  const load = async (path = currentPath) => {
    if (!path) return;
    setLoading(true);
    try {
      const data = await request("file.list", { path });
      setCurrentPath(data.path);
      setPathInput(data.path);
      setParentPath(data.parent || "");
      setRoots(data.roots || roots);
      setEntries(data.entries || []);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "目录加载失败");
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    handleMessage(message) {
      if (message.type === "file.response") {
        const waiting = pending.current.get(message.id);
        if (!waiting) return;
        pending.current.delete(message.id);
        window.clearTimeout(waiting.timeout);
        if (message.ok) waiting.resolve(message.data);
        else waiting.reject(new Error(message.error || "文件操作失败"));
        return;
      }
      if (message.type === "file.download.begin") {
        downloads.current.set(message.id, {
          name: message.name || "download",
          size: message.size || 0,
          received: 0,
          chunks: [],
        });
        setTransferLabel(`正在下载 ${message.name || "文件"}`);
        return;
      }
      if (message.type === "file.download.chunk") {
        const download = downloads.current.get(message.id);
        if (!download || typeof (message as any).data !== "string") return;
        const chunk = fromBase64((message as any).data);
        download.chunks.push(chunk);
        download.received += chunk.byteLength;
        setTransferLabel(`正在下载 ${download.name} ${Math.round((download.received / Math.max(1, download.size)) * 100)}%`);
        return;
      }
      if (message.type === "file.download.end") {
        const download = downloads.current.get(message.id);
        if (!download) return;
        downloads.current.delete(message.id);
        const blob = new Blob(download.chunks as BlobPart[]);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = download.name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setTransferLabel("");
        toast.success(`${download.name} 下载完成`);
        return;
      }
      if (message.type === "file.download.error") {
        downloads.current.delete(message.id);
        setTransferLabel("");
        toast.error((message as any).error || "下载失败");
      }
    },
    initialize(nextRoots, home, nextSeparator) {
      setRoots(nextRoots);
      setSeparator(nextSeparator || "/");
      void load(home || nextRoots[0]);
    },
    refresh() {
      void load();
    },
  }));

  useEffect(() => () => {
    for (const waiting of pending.current.values()) {
      window.clearTimeout(waiting.timeout);
      waiting.reject(new Error("远程连接已关闭"));
    }
    pending.current.clear();
    downloads.current.clear();
  }, []);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => showHidden || !entry.hidden),
    [entries, showHidden],
  );
  const selectedEntries = entries.filter((entry) => selected.has(entry.path));
  const actionableEntries = selectedEntries.filter((entry) => !entry.protected);

  const toggleSelected = (entry: FileEntry) => {
    if (entry.protected) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
  };

  const createEntry = async () => {
    if (!createKind || !createName.trim()) return;
    try {
      await request(createKind === "folder" ? "file.mkdir" : "file.create", {
        path: joinRemotePath(currentPath, createName.trim(), separator),
      });
      setCreateKind(null);
      setCreateName("");
      await load();
      toast.success(createKind === "folder" ? "文件夹已创建" : "文件已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  };

  const rename = async () => {
    if (!renameEntry || !renameName.trim()) return;
    try {
      await request("file.rename", {
        path: renameEntry.path,
        destination: joinRemotePath(currentPath, renameName.trim(), separator),
      });
      setRenameEntry(null);
      await load();
      toast.success("重命名完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名失败");
    }
  };

  const removeSelected = async () => {
    try {
      for (const entry of actionableEntries) {
        await request("file.delete", { path: entry.path, recursive: entry.directory });
      }
      setDeleteOpen(false);
      await load();
      toast.success("删除完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const downloadSelected = () => {
    for (const entry of actionableEntries.filter((item) => !item.directory && !item.symlink)) {
      const id = crypto.randomUUID();
      if (!send({ type: "file.download", id, path: entry.path })) {
        toast.error("远程连接尚未就绪");
        return;
      }
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) {
        setTransferLabel(`正在上传 ${file.name} 0%`);
        const start = await request("file.upload.start", {
          path: joinRemotePath(currentPath, file.name, separator),
          size: file.size,
          overwrite,
        });
        const uploadID = start.upload_id;
        let sent = 0;
        while (sent < file.size) {
          const buffer = await file.slice(sent, sent + uploadChunkSize).arrayBuffer();
          await request("file.upload.chunk", {
            upload_id: uploadID,
            data: toBase64(buffer),
          });
          sent += buffer.byteLength;
          setTransferLabel(`正在上传 ${file.name} ${Math.round((sent / Math.max(1, file.size)) * 100)}%`);
        }
        await request("file.upload.finish", { upload_id: uploadID });
        toast.success(`${file.name} 上传完成`);
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setTransferLabel("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="remote-files" aria-label="文件管理">
      <div className="remote-files-title">
        <div>
          <strong>文件管理</strong>
          <span>{connected ? "已连接" : "未连接"}</span>
        </div>
        <IconButton size="1" variant="ghost" title="刷新" onClick={() => void load()} disabled={!connected || loading}>
          <RefreshCw size={15} className={loading ? "remote-spin" : ""} />
        </IconButton>
      </div>

      <div className="remote-file-path">
        <IconButton size="1" variant="soft" title="上一级" disabled={!parentPath} onClick={() => void load(parentPath)}>
          <ArrowUp size={15} />
        </IconButton>
        <select disabled={!connected} value={roots.includes(currentPath) ? currentPath : ""} onChange={(event) => event.target.value && void load(event.target.value)} title="磁盘或根目录">
          <option value="">根目录</option>
          {roots.map((root) => <option key={root} value={root}>{root}</option>)}
        </select>
        <TextField.Root
          size="1"
          disabled={!connected}
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void load(pathInput)}
        />
      </div>

      <div className="remote-file-toolbar">
        <input ref={inputRef} type="file" multiple hidden onChange={(event) => void uploadFiles(event.target.files)} />
        <Button size="1" variant="soft" onClick={() => inputRef.current?.click()} disabled={!connected}>
          <Upload size={14} /> 上传
        </Button>
        <IconButton size="1" variant="soft" title="新建文件" disabled={!connected} onClick={() => setCreateKind("file")}><FilePlus2 size={14} /></IconButton>
        <IconButton size="1" variant="soft" title="新建文件夹" disabled={!connected} onClick={() => setCreateKind("folder")}><FolderPlus size={14} /></IconButton>
        <IconButton size="1" variant="soft" title="下载" disabled={!actionableEntries.some((entry) => !entry.directory && !entry.symlink)} onClick={downloadSelected}><Download size={14} /></IconButton>
        <IconButton size="1" variant="soft" title="重命名" disabled={actionableEntries.length !== 1} onClick={() => {
          const entry = actionableEntries[0];
          if (entry) { setRenameEntry(entry); setRenameName(entry.name); }
        }}><Pencil size={14} /></IconButton>
        <IconButton size="1" color="red" variant="soft" title="删除" disabled={actionableEntries.length === 0} onClick={() => setDeleteOpen(true)}><Trash2 size={14} /></IconButton>
      </div>

      <div className="remote-file-options">
        <label><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /> 显示隐藏文件</label>
        <label><input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} /> 覆盖同名文件</label>
      </div>

      {transferLabel && <div className="remote-transfer-status">{transferLabel}</div>}

      <div className="remote-file-table-wrap">
        <table className="remote-file-table">
          <thead><tr><th aria-label="选择" /><th>名称</th><th>大小</th><th>修改时间</th></tr></thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.path} className={entry.protected ? "is-protected" : ""} onDoubleClick={() => entry.directory && void load(entry.path)}>
                <td><input type="checkbox" checked={selected.has(entry.path)} disabled={entry.protected} onChange={() => toggleSelected(entry)} /></td>
                <td title={entry.protected ? "SQLite 数据库已受保护" : entry.path}>
                  {entry.protected ? <LockKeyhole size={15} /> : entry.directory ? <Folder size={15} /> : <FileIcon size={15} />}
                  <span>{entry.name}</span>
                </td>
                <td>{entry.directory ? "-" : formatBytes(entry.size)}</td>
                <td>{formatDate(entry.modified_at)}</td>
              </tr>
            ))}
            {!loading && visibleEntries.length === 0 && <tr><td colSpan={4} className="remote-file-empty"><HardDrive size={18} /> 当前目录为空</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={createKind !== null} onOpenChange={(open) => !open && setCreateKind(null)}>
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>{createKind === "folder" ? "新建文件夹" : "新建文件"}</Dialog.Title>
          <TextField.Root autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void createEntry()} />
          <div className="remote-dialog-actions"><Button variant="soft" onClick={() => setCreateKind(null)}>取消</Button><Button onClick={() => void createEntry()}>创建</Button></div>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={renameEntry !== null} onOpenChange={(open) => !open && setRenameEntry(null)}>
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>重命名</Dialog.Title>
          <TextField.Root autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void rename()} />
          <div className="remote-dialog-actions"><Button variant="soft" onClick={() => setRenameEntry(null)}>取消</Button><Button onClick={() => void rename()}>保存</Button></div>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>删除所选项目</Dialog.Title>
          <Dialog.Description>将永久删除 {actionableEntries.length} 个项目，文件夹会连同内容一起删除。</Dialog.Description>
          <div className="remote-dialog-actions"><Button variant="soft" onClick={() => setDeleteOpen(false)}>取消</Button><Button color="red" onClick={() => void removeSelected()}>删除</Button></div>
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
});

FileManager.displayName = "FileManager";

export default FileManager;
