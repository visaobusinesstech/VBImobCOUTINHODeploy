import {
  buildInstagramAuthorizeUrl,
  buildInstagramFreshSessionStartUrl,
  isSafeInstagramAuthorizeUrl,
  resolveInstagramOAuthPopupStartUrl,
  IG_OAUTH_STATE_POPUP,
} from "../pages/Connections/instagramOAuthPopup";

describe("instagramOAuthPopup", () => {
  const auth = () =>
    buildInstagramAuthorizeUrl(
      "123456",
      "https://vbsolution.com.br/connections/instagram-oauth",
      "instagram_business_basic"
    );

  it("buildInstagramAuthorizeUrl aponta para /oauth/authorize com force_reauth", () => {
    const url = auth();
    const u = new URL(url);
    expect(u.hostname).toBe("www.instagram.com");
    expect(u.pathname).toBe("/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("123456");
    expect(u.searchParams.get("force_reauth")).toBe("true");
    expect(u.searchParams.get("state")).toBe(IG_OAUTH_STATE_POPUP);
    expect(u.searchParams.get("redirect_uri")).toContain("/connections/instagram-oauth");
  });

  it("default do popup é authorize direto (não logout/feed)", () => {
    const authorizeUrl = auth();
    expect(resolveInstagramOAuthPopupStartUrl(authorizeUrl)).toBe(authorizeUrl);
    expect(resolveInstagramOAuthPopupStartUrl(authorizeUrl)).not.toContain("accounts/logout");
  });

  it("isSafeInstagramAuthorizeUrl rejeita homepage do Instagram", () => {
    expect(isSafeInstagramAuthorizeUrl("https://www.instagram.com/")).toBe(false);
    expect(isSafeInstagramAuthorizeUrl("https://www.instagram.com/oauth/authorize?x=1")).toBe(
      true
    );
  });

  it("fresh session URL ainda existe mas não é o default", () => {
    const authorizeUrl = auth();
    const fresh = buildInstagramFreshSessionStartUrl(authorizeUrl);
    expect(fresh).toContain("accounts/logout");
    expect(fresh).not.toBe(authorizeUrl);
  });
});
