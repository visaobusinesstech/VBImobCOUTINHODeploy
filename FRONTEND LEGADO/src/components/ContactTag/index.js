import React from "react";
import NotionTag from "../ui/NotionTag";

const ContactTag = ({ tag, fullLabel = true }) => {
  if (!tag?.name) return null;
  return (
    <NotionTag
      label={tag.name}
      color={tag.color}
      title={tag.name}
      fullLabel={fullLabel}
    />
  );
};

export default ContactTag;
