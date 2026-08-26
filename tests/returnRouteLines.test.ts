import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/pages/admin/returnRoute.tsx", import.meta.url),
  "utf8",
);

test("联通线路选择使用 CUG 名称且不再暴露独立 10099", () => {
  assert.match(
    source,
    /unicom:\s*\["CUG VIP",\s*"CUG 优化",\s*"9929",\s*"4837"\]/,
  );
  assert.doesNotMatch(source, /unicom:\s*\[[^\]]*"10099"/);
});

test("编辑表单只在打开弹窗时读取任务数据", () => {
  assert.match(
    source,
    /const handleOpenChange = \(nextOpen: boolean\) => \{\s*if \(nextOpen\) \{\s*setForm\(toTaskForm\(task\)\);\s*setSelectedClients\(task\?\.client \? \[task\.client\] : \[\]\);\s*\}\s*setOpen\(nextOpen\);\s*\};/,
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => setForm\(toTaskForm\(task\)\), \[task, open\]\)/,
  );
});

test("新建任务使用原选择框外观进行节点多选", () => {
  assert.match(source, /const \[selectedClients, setSelectedClients\] = useState<string\[]>/);
  assert.match(source, /function MultiNodeSelect/);
  assert.match(source, /<AdminMultiSelect/);
  assert.match(source, /placeholder="选择服务器（支持多选）"/);
  assert.match(source, /<MultiNodeSelect[\s\S]*value=\{selectedClients\}[\s\S]*onChange=\{setSelectedClients\}/);
  assert.doesNotMatch(source, /<NodeSelectorDialog/);
  assert.match(source, /for \(const client of clients\) \{[\s\S]*request\([\s\S]*"\/add"/);
  assert.match(source, /if \(task\?\.id\) \{\s*await request\("\/edit", toTaskPayload\(form\)\)/);
  assert.doesNotMatch(source, /find\([^\n]*carrier[^\n]*target/);
});

test("任务列表提供明确勾选和后端批量修改入口", () => {
  assert.match(source, /const \[selectedTaskIDs, setSelectedTaskIDs\] = useState<Set<number>>/);
  assert.match(source, /allVisibleTasksSelected \? "取消全选" : "全选"/);
  assert.match(source, /<span className="sr-only">选择<\/span>/);
  assert.doesNotMatch(source, /选择当前页全部任务/);
  assert.match(source, /<RouteTaskBatchDialog/);
  assert.match(source, />批量修改/);
  assert.match(source, /request\("\/edit\/batch", \{ ids, \.\.\.toTaskBatchPayload\(form\) \}\)/);
  assert.match(source, /任务名称和各自的探测节点保持不变/);
});

test("刷新后仍停留在当前监测页签，告警深链未指定页签时才回到任务", () => {
  assert.match(source, /useAdminTabParam\(\s*RETURN_ROUTE_TABS,\s*"tasks"/);
  assert.match(source, /if \(searchParams.get\("tab"\)\) return;/);
  assert.match(source, /setActiveTab\("tasks"\)/);
});

test("回程任务、记录和规则复用服务器列表的筛选条和表格卡片", () => {
  assert.match(source, /<AdminListShell>/);
  assert.match(source, /<AdminListSearch/);
  assert.match(source, /AdminListSearch[\s\S]*取消全选[\s\S]*批量修改[\s\S]*新建任务/);
  assert.match(source, /className="admin-responsive-table w-full min-w-\[1120px\]/);
  assert.match(source, /data-label="任务 \/ 节点"/);
  assert.match(source, /data-label="线路变化"/);
  assert.match(source, /data-label="操作" className="p-3"><Flex justify="start"/);
  assert.match(source, /<TableHead>操作<\/TableHead>/);
  assert.doesNotMatch(source, /overflow-hidden rounded-md border border-\[var\(--gray-a5\)\]/);
});

test("手机端回程任务把同一字段的主次信息保持在同一内容列", () => {
  assert.match(source, /data-label="任务 \/ 节点"[\s\S]*return-route-cell-pair/);
  assert.match(source, /data-label="运营商 \/ 地区"[\s\S]*return-route-cell-pair/);
  assert.match(source, /data-label="线路"[\s\S]*return-route-cell-pair/);
  assert.match(source, /data-label="最后探测"[\s\S]*return-route-cell-pair/);
  assert.match(source, /data-label="状态"[\s\S]*return-route-cell-content/);
});

test("CN2 和 CUG 待确认不显示切线确认次数", () => {
  assert.match(source, /new Set\(\["CN2 待确认", "CUG 待确认"\]\)/);
  assert.match(source, /pendingLineOptions\.has\(status\.candidate_line\) \? null/);
  assert.match(source, /status\.candidate_count\}\/\{needed\}/);
});
