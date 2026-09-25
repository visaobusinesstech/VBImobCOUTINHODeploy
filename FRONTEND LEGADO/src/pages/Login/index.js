import React, { useState, useContext, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import useAppTranslation from "../../hooks/useAppTranslation";
import { AuthContext } from "../../context/Auth/AuthContext";
import IconButton from "@material-ui/core/IconButton";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import InputAdornment from "@material-ui/core/InputAdornment";
import { Helmet } from "react-helmet";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import useSettings from "../../hooks/useSettings";
import MinimalLanguageSelector from "../../components/MinimalLanguageSelector";
import logoVB from "../../assets/LOGO VB-PNG.png";
import { openApi } from "../../services/api";
import {
    openGoogleLoginPopup,
    subscribeGoogleLoginCallback,
} from "../../utils/googleLoginOAuth";

const LOGIN_BG_URL = `${process.env.PUBLIC_URL || ""}/login-bg-space.png`;

const useStyles = makeStyles(() => ({
    root: {
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "#010a1f",
    },
    bgLayer: {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        backgroundColor: "#010a1f",
    },
    bgFallback: {
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, #010a1f 0%, #061a3d 42%, #0a2a5c 100%)",
    },
    bgImage: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center bottom",
        opacity: 0.58,
        imageRendering: "auto",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        filter: "brightness(0.78) saturate(1.15) hue-rotate(8deg)",
    },
    bgOverlay: {
        position: "absolute",
        inset: 0,
        background: [
            "radial-gradient(ellipse 85% 65% at 50% 35%, rgba(11, 42, 126, 0.28) 0%, rgba(1, 10, 31, 0.72) 100%)",
            "linear-gradient(180deg, rgba(1, 10, 31, 0.35) 0%, rgba(6, 26, 61, 0.22) 48%, rgba(1, 10, 31, 0.55) 100%)",
        ].join(", "),
        pointerEvents: "none",
    },
    centerWrap: {
        position: "relative",
        zIndex: 2,
        width: "100%",
        maxWidth: 440,
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    paper: {
        width: "100%",
        padding: "34px 32px 30px",
        borderRadius: 24,
        background: "rgba(22, 22, 24, 0.68)",
        backdropFilter: "blur(40px) saturate(1.2)",
        WebkitBackdropFilter: "blur(40px) saturate(1.2)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: [
            "0 0 0 0.5px rgba(255, 255, 255, 0.05) inset",
            "0 32px 64px rgba(0, 0, 0, 0.38)",
        ].join(", "),
        animation: "$fadeUp 0.6s ease-out",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", sans-serif',
    },
    heroLogo: {
        width: 100,
        height: "auto",
        marginBottom: 4,
        opacity: 0.96,
    },
    welcome: {
        fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        marginTop: 0,
        marginBottom: 20,
        textAlign: "center",
        lineHeight: 1.2,
        color: "#ffffff",
    },
    "@keyframes fadeUp": {
        from: { opacity: 0, transform: "translateY(18px)" },
        to: { opacity: 1, transform: "translateY(0)" },
    },
    form: {
        width: "100%",
    },
    formSurface: {
        width: "100%",
        padding: "4px 0 0",
    },
    authNotice: {
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(248, 113, 113, 0.2)",
        textAlign: "left",
        width: "100%",
    },
    authNoticeTitle: {
        color: "#fecaca",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.45,
        marginBottom: 4,
    },
    authNoticeEmail: {
        color: "#fca5a5",
        fontSize: 12,
        marginBottom: 8,
        wordBreak: "break-word",
    },
    authNoticeLink: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": {
            textDecoration: "underline",
        },
    },
    textField: {
        marginTop: 10,
        marginBottom: 2,
        "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.07)",
            minHeight: 50,
            transition: "background-color 0.25s ease",
            "& fieldset": {
                border: "none",
            },
            "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.09)",
            },
            "&.Mui-focused": {
                backgroundColor: "rgba(255, 255, 255, 0.11)",
                boxShadow: "none",
            },
            "&.Mui-focused fieldset": {
                border: "none",
            },
        },
        "& .MuiOutlinedInput-notchedOutline": {
            border: "none",
        },
        "& .MuiOutlinedInput-input": {
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            caretColor: "#ffffff",
            padding: "14px 16px",
        },
        "& input:-webkit-autofill": {
            WebkitBoxShadow: "0 0 0 1000px rgba(44, 44, 46, 0.95) inset",
            WebkitTextFillColor: "#ffffff",
            caretColor: "#ffffff",
            transition: "background-color 9999s ease-out 0s",
        },
        "& .MuiInputLabel-root": {
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            "&.Mui-focused": {
                color: "#ffffff",
            },
            "&.MuiInputLabel-shrink": {
                color: "#ffffff",
            },
        },
        "& .MuiFormHelperText-root": {
            color: "rgba(255, 255, 255, 0.45)",
        },
    },
    registerLink: {
        color: "rgba(255, 255, 255, 0.55)",
        textDecoration: "none",
        fontSize: 12,
        fontWeight: 400,
        display: "block",
        textAlign: "right",
        marginTop: 6,
        transition: "color 0.2s ease",
        "&:hover": {
            color: "rgba(255, 255, 255, 0.88)",
            textDecoration: "none",
        },
    },
    submit: {
        marginTop: 20,
        marginBottom: 4,
        background: "rgba(255, 255, 255, 0.92)",
        color: "#09090b !important",
        borderRadius: 12,
        padding: "11px 0",
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        textTransform: "none",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
        transition: "background 0.2s ease, transform 0.15s ease",
        "&:hover": {
            background: "#ffffff",
            color: "#09090b !important",
        },
        "&:active": {
            transform: "scale(0.985)",
        },
        "&:focus": {
            outline: "none",
        },
    },
    dividerRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "16px 0 14px",
    },
    dividerLine: {
        flex: 1,
        height: 1,
        background: "rgba(255, 255, 255, 0.08)",
    },
    dividerText: {
        color: "rgba(255, 255, 255, 0.38)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
    },
    googleButton: {
        padding: "11px 16px",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        textTransform: "none",
        background: "rgba(255, 255, 255, 0.07)",
        color: "rgba(255, 255, 255, 0.92)",
        border: "none",
        boxShadow: "none",
        transition: "background 0.25s ease",
        "&:hover": {
            background: "rgba(255, 255, 255, 0.11)",
        },
        "&:focus": {
            outline: "none",
        },
    },
    googleButtonIcon: {
        width: 18,
        height: 18,
        marginRight: 8,
    },
}));

function GoogleIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

const Login = () => {
    const { t } = useAppTranslation();
    const classes = useStyles();
    const [user, setUser] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const { getPublicSetting } = useSettings();
    const { handleLogin, handleGoogleLoginComplete } = useContext(AuthContext);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleConfigured, setGoogleConfigured] = useState(true);
    const [googleAuthError, setGoogleAuthError] = useState(null);
    const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en", "es", "ar"]);

    const getCompanyIdFromUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const companyId = urlParams.get("companyId");
        return companyId ? parseInt(companyId, 10) : null;
    };

    const handleChangeInput = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
        if (googleAuthError) setGoogleAuthError(null);
    };

    const handlSubmit = (e) => {
        e.preventDefault();
        setGoogleAuthError(null);
        handleLogin(user);
    };

    const resolveGoogleLoginError = (message) => {
        const msg = String(message || "");
        if (msg === "ERR_GOOGLE_EMAIL_NOT_REGISTERED") {
            return t("login.alerts.googleNotRegistered");
        }
        if (msg === "ERR_OUT_OF_HOURS") {
            return t("login.toasts.outOfHours");
        }
        if (msg === "ERR_GOOGLE_LOGIN_INVALID") {
            return t("login.toasts.googleLoginInvalid");
        }
        return msg || t("login.toasts.googleFailed");
    };

    const handleGoogleLogin = () => {
        setGoogleAuthError(null);
        setGoogleLoading(true);
        const { ok } = openGoogleLoginPopup();
        if (!ok) {
            setGoogleLoading(false);
            toast.warn(t("login.toasts.popupBlocked"));
        }
    };

    useEffect(() => {
        return subscribeGoogleLoginCallback(async (payload) => {
            setGoogleLoading(false);

            if (payload.status === "success" && payload.exchange) {
                setGoogleAuthError(null);
                try {
                    await handleGoogleLoginComplete(payload.exchange);
                } catch (err) {
                    toastError(err);
                }
                return;
            }

            if (payload.message === "ERR_GOOGLE_EMAIL_NOT_REGISTERED") {
                setGoogleAuthError({
                    email: payload.email || "",
                    message: t("login.alerts.googleNotRegistered"),
                });
                return;
            }

            toast.error(resolveGoogleLoginError(payload.message));
        });
    }, [handleGoogleLoginComplete, t]);

    useEffect(() => {
        const companyId = getCompanyIdFromUrl();

        getPublicSetting("enabledLanguages", companyId)
            .then((langs) => {
                let arr = ["pt-BR", "en", "es", "ar"];
                try {
                    if (langs) arr = JSON.parse(langs);
                } catch {}
                setEnabledLanguages(arr);
            })
            .catch(() => {
                setEnabledLanguages(["pt-BR", "en", "es", "ar"]);
            });

        openApi
            .get("/auth/google/status")
            .then(({ data }) => {
                setGoogleConfigured(data?.configured !== false);
            })
            .catch(() => {
                setGoogleConfigured(false);
            });
    }, [getPublicSetting]);

    return (
        <>
            <Helmet>
                <title>VBSolution - Login</title>
                <link rel="icon" href="/favicon.png" />
            </Helmet>

            <div className={classes.root}>
                <div className={classes.bgLayer} aria-hidden="true">
                    <div className={classes.bgFallback} />
                    <img
                        src={LOGIN_BG_URL}
                        alt=""
                        className={classes.bgImage}
                        draggable={false}
                        decoding="async"
                        loading="eager"
                    />
                    <div className={classes.bgOverlay} />
                </div>

                <MinimalLanguageSelector enabledLanguages={enabledLanguages} variant="dark" />

                <div className={classes.centerWrap}>
                    <CssBaseline />
                    <div className={classes.paper}>
                        <img src={logoVB} alt="VBsolution" className={classes.heroLogo} />
                        <Typography component="h1" className={classes.welcome}>
                            {t("login.welcome")}
                        </Typography>

                        {googleAuthError && (
                            <div className={classes.authNotice}>
                                <Typography className={classes.authNoticeTitle}>
                                    {googleAuthError.message}
                                </Typography>
                                {googleAuthError.email ? (
                                    <Typography className={classes.authNoticeEmail}>
                                        {googleAuthError.email}
                                    </Typography>
                                ) : null}
                                <Link
                                    component={RouterLink}
                                    to="/register"
                                    className={classes.authNoticeLink}
                                >
                                    {t("login.links.createAccount")}
                                </Link>
                            </div>
                        )}

                        <form className={classes.form} noValidate onSubmit={handlSubmit}>
                            <div className={classes.formSurface}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                id="email"
                                label={t("login.form.email")}
                                name="email"
                                value={user.email}
                                onChange={handleChangeInput}
                                autoComplete="email"
                                autoFocus
                                className={classes.textField}
                            />
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                name="password"
                                label={t("login.form.password")}
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={user.password}
                                onChange={handleChangeInput}
                                autoComplete="current-password"
                                className={classes.textField}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                aria-label="toggle password visibility"
                                                onClick={() => setShowPassword((value) => !value)}
                                                edge="end"
                                                size="small"
                                                style={{ color: "rgba(255, 255, 255, 0.72)" }}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Grid container>
                                <Grid item xs>
                                    <Link
                                        href="#"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            if (!user.email || !/\S+@\S+\.\S+/.test(user.email)) {
                                                toast.warn(t("login.toasts.invalidEmail"));
                                                return;
                                            }
                                            toast.info(t("login.toasts.forgotPasswordInfo"));
                                            try {
                                                const { data } = await openApi.post("/auth/forgot-password", {
                                                    email: user.email,
                                                });
                                                const url = data?.redirectUrl;
                                                if (url) {
                                                    window.location.assign(url);
                                                }
                                            } catch (err) {
                                                toastError(err);
                                            }
                                        }}
                                        variant="body2"
                                        className={classes.registerLink}
                                    >
                                        {t("login.links.forgotPassword")}
                                    </Link>
                                </Grid>
                            </Grid>
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                className={classes.submit}
                            >
                                {t("login.buttons.submit")}
                            </Button>

                            {googleConfigured && (
                                <>
                                    <div className={classes.dividerRow}>
                                        <span className={classes.dividerLine} />
                                        <span className={classes.dividerText}>{t("login.or")}</span>
                                        <span className={classes.dividerLine} />
                                    </div>
                                    <Button
                                        type="button"
                                        fullWidth
                                        variant="contained"
                                        className={classes.googleButton}
                                        onClick={handleGoogleLogin}
                                        disabled={googleLoading}
                                    >
                                        <GoogleIcon className={classes.googleButtonIcon} />
                                        {googleLoading
                                            ? t("login.buttons.googleLoading")
                                            : t("login.buttons.google")}
                                    </Button>
                                </>
                            )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
