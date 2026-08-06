import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box, Flex, Heading, Tabs } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import {
  SettingCardLongTextInput,
  SettingCardSelect,
  SettingCardShortTextInput,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import type { I18nText } from "@/utils/i18nText";
import {
  groupThemeConfigFields,
  type ThemeConfigTabField,
} from "@/utils/themeConfigTabs";

interface ThemeConfigTabsProps {
  fields: ThemeConfigTabField[];
  values: Record<string, any>;
  onValueChange: (key: string, value: any) => void;
  resolveText: (value?: I18nText) => string | undefined;
  footer?: ReactNode;
}

const ThemeConfigTabs = ({
  fields,
  values,
  onValueChange,
  resolveText,
  footer,
}: ThemeConfigTabsProps) => {
  const { t } = useTranslation();
  const groups = useMemo(() => groupThemeConfigFields(fields), [fields]);
  const [activeTab, setActiveTab] = useState(0);
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActiveTab(0);
    tabRefs.current = tabRefs.current.slice(0, groups.length);
  }, [groups]);

  useEffect(() => {
    const list = tabsListRef.current;
    const tab = tabRefs.current[activeTab];
    if (!list || !tab) return;
    const listRect = list.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    if (tabRect.left < listRect.left) {
      list.scrollBy({ left: tabRect.left - listRect.left - 12 });
    } else if (tabRect.right > listRect.right) {
      list.scrollBy({ left: tabRect.right - listRect.right + 12 });
    }
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    const index = Number(value);
    if (Number.isNaN(index) || index < 0 || index >= groups.length) return;
    setActiveTab(index);
  };

  const renderField = (field: ThemeConfigTabField) => {
    const key = field.key!;
    const value = values[key];
    const title = resolveText(field.name);
    const description = resolveText(field.help);

    switch (field.type) {
      case "switch":
        return (
          <Box key={key} id={key}>
            <SettingCardSwitch
              title={title}
              description={description}
              defaultChecked={Boolean(value)}
              onChange={(checked) => onValueChange(key, checked)}
            />
          </Box>
        );
      case "select": {
        const options = (field.options || "")
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean)
          .map((option) => ({
            value: option,
            label: resolveText(field.optionLabels?.[option]),
          }));
        const selectedValue = value === undefined ? "" : String(value);
        const selectedLabel =
          options.find((option) => option.value === selectedValue)?.label ||
          selectedValue;
        return (
          <Box key={key} id={key}>
            <SettingCardSelect
              title={title}
              description={description}
              value={selectedValue}
              options={options}
              OnSave={(next) => onValueChange(key, next)}
              label={selectedLabel || t("common.select")}
            />
          </Box>
        );
      }
      case "number":
        return (
          <Box key={key} id={key}>
            <SettingCardShortTextInput
              title={title}
              description={description}
              type="number"
              showSaveButton={false}
              value={value !== undefined ? String(value) : ""}
              onChange={(event) =>
                onValueChange(
                  key,
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
                )
              }
            />
          </Box>
        );
      case "richtext":
        return (
          <Box key={key} id={key}>
            <SettingCardLongTextInput
              title={title}
              description={description}
              defaultValue={value !== undefined ? String(value) : ""}
              showSaveButton={false}
              onChange={(event) => onValueChange(key, event.target.value)}
            />
          </Box>
        );
      case "string":
      default:
        return (
          <Box key={key} id={key}>
            <SettingCardShortTextInput
              title={title}
              description={description}
              value={value !== undefined ? String(value) : ""}
              required={field.required}
              showSaveButton={false}
              onChange={(event) => onValueChange(key, event.target.value)}
            />
          </Box>
        );
    }
  };

  const currentTab = Math.min(activeTab, Math.max(groups.length - 1, 0));
  const activeGroup = groups[currentTab];

  return (
    <Flex direction="column" gap="4" className="km-theme-config-form">
      {groups.length > 1 && (
        <Box className="km-theme-config-tabs">
          <Tabs.Root
            value={String(currentTab)}
            onValueChange={handleTabChange}
          >
            <Tabs.List
              ref={tabsListRef}
              className="km-theme-config-tabs-list"
            >
              {groups.map((group, index) => (
                <Tabs.Trigger
                  key={index}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  value={String(index)}
                  className="km-theme-config-tabs-trigger"
                >
                  {group.title
                    ? resolveText(group.title) || t("common.title")
                    : t("settings.general.title")}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </Box>
      )}

      {activeGroup && (
        <Box className="km-theme-config-section">
          {activeGroup.title && (
            <Heading size="3">
              {resolveText(activeGroup.title) || t("common.title")}
            </Heading>
          )}
          <Flex direction="column" gap="3" className="mt-5 mb-3">
            {activeGroup.items.map(renderField)}
          </Flex>
        </Box>
      )}
      {footer}
    </Flex>
  );
};

export default ThemeConfigTabs;
