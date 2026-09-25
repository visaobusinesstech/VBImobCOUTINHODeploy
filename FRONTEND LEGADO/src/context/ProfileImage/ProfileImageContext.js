import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { AuthContext } from "../Auth/AuthContext";
import { getBackendUrl } from "../../config";

const ProfileImageContext = createContext();

const ProfileImageProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [overrideImage, setOverrideImage] = useState(null);

  const profileImage = overrideImage != null
    ? overrideImage
    : user?.profileImage
      ? `${getBackendUrl()}/public/${user.profileImage}`
      : null;

  const updateProfileImage = useCallback((newProfileImage) => {
    setOverrideImage(newProfileImage);
  }, []);

  const value = useMemo(
    () => ({ user, profileImage, updateProfileImage }),
    [user, profileImage, updateProfileImage]
  );

  return (
    <ProfileImageContext.Provider value={value}>
      {children}
    </ProfileImageContext.Provider>
  );
};

export { ProfileImageContext, ProfileImageProvider };
