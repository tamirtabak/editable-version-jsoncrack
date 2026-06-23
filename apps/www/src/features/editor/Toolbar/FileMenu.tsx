import React, { useState } from "react";
import { Flex, Menu } from "@mantine/core";
import { TemplatesModal } from "../views/GraphView/overlays/TemplatesModal";
import { event as gaEvent } from "nextjs-google-analytics";
import { CgChevronDown } from "react-icons/cg";
import useFile from "../../../store/useFile";
import { useModal } from "../../../store/useModal";
import { StyledToolElement } from "./styles";

export const FileMenu = () => {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const setVisible = useModal(state => state.setVisible);
  const getContents = useFile(state => state.getContents);
  const getFormat = useFile(state => state.getFormat);

  const handleSave = () => {
    const a = document.createElement("a");
    const file = new Blob([getContents()], { type: "text/plain" });

    a.href = window.URL.createObjectURL(file);
    a.download = `jsoncrack.${getFormat()}`;
    a.click();

    gaEvent("save_file", { label: getFormat() });
  };

  return (
    <Menu shadow="md" withArrow>
      <Menu.Target>
        <StyledToolElement title="File">
          <Flex align="center" gap={3}>
            File
            <CgChevronDown />
          </Flex>
        </StyledToolElement>
      </Menu.Target>
      <Menu.Dropdown>
		<Menu.Item onClick={() => setTemplatesOpen(true)}>New / Templates</Menu.Item>
		<Menu.Item onClick={() => setVisible("ImportModal", true)}>Import</Menu.Item>
        <Menu.Item onClick={handleSave}>Export</Menu.Item>
      </Menu.Dropdown>
	 <TemplatesModal opened={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </Menu>
  );
};
