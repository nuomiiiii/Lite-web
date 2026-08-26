import Stack from "@mui/material/Stack";
import { Outlet } from "react-router-dom";

export default function SettingLayout() {
  return (
    <Stack
      spacing={2.5}
      className="p-0 md:p-4"
      sx={{ width: "100%", minWidth: 0 }}
    >
      <Outlet />
    </Stack>
  );
}
