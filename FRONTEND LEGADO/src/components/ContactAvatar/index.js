import React, { useEffect, useMemo, useState } from "react";
import { Avatar, makeStyles } from "@material-ui/core";
import { getBackendUrl } from "../../config";
import {
  getContactAvatarState,
  isUsableProfilePic
} from "../../utils/contactAvatar";

const useStyles = makeStyles(() => ({
  root: {
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#fff",
    flexShrink: 0
  }
}));

/**
 * Avatar de contato: foto em cache → iniciais → avatar padrão.
 * Baileys/fonte externa é opcional; não bloqueia a UI.
 */
const ContactAvatar = ({
  contact,
  src: srcProp,
  size = 40,
  className,
  onClick,
  alt,
  resolveImageUrl,
  style,
  ...rest
}) => {
  const classes = useStyles();
  const backendUrl = getBackendUrl();

  const resolve = useMemo(() => {
    if (typeof resolveImageUrl === "function") return resolveImageUrl;
    return (url) => {
      if (!url || typeof url !== "string") return "";
      const u = url.trim();
      if (/^(data:|blob:|https?:\/\/)/i.test(u)) return u;
      if (u.startsWith("/")) return `${backendUrl}${u}`;
      return `${backendUrl}/public/${u}`;
    };
  }, [resolveImageUrl, backendUrl]);

  const state = useMemo(
    () => getContactAvatarState(contact, resolve),
    [contact, resolve]
  );

  const preferredSrc = isUsableProfilePic(srcProp)
    ? resolve(srcProp)
    : state.src;

  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [preferredSrc, contact?.id, contact?.urlPicture, contact?.profilePicUrl]);

  const showPhoto = Boolean(preferredSrc) && !broken;
  const initials = state.initials;
  const bg = showPhoto ? undefined : state.color || "#6B7280";

  return (
    <Avatar
      alt={alt || contact?.name || "Contato"}
      src={showPhoto ? preferredSrc : undefined}
      className={`${classes.root}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      onError={() => setBroken(true)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        backgroundColor: bg,
        ...style
      }}
      {...rest}
    >
      {!showPhoto ? initials || "?" : null}
    </Avatar>
  );
};

export default ContactAvatar;
