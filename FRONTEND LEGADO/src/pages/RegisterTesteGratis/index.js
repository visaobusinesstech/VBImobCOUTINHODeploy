import React, { useContext, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import NumberFormat from "react-number-format";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  InputLabel,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import { openApi } from "../../services/api";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import MinimalLanguageSelector from "../../components/MinimalLanguageSelector";
import logoVBBlack from "../../assets/LOGO VB PRETO.png";
import { PREMIUM_FONT_FAMILY } from "../../constants/typography";
import useAppTranslation from "../../hooks/useAppTranslation";

const CLICKUP_FONT = PREMIUM_FONT_FAMILY;
const PHONE_FORMAT = "+55 (##) #####-####";

const useStyles = makeStyles(theme => {
  const inputBg = "#f5f5f7";
  const inputBgHover = "#ebebed";
  const inputBgFocus = "#e8e8ed";
  const labelColor = "#3a3a3c";
  const textColor = "#111113";
  const mutedColor = "#3a3a3c";

  return {
    root: {
      minHeight: "100dvh",
      height: "100dvh",
      width: "100%",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      background: "#f5f5f7",
      padding: theme.spacing(2.5, 2, 3),
      fontFamily: CLICKUP_FONT,
      color: textColor,
      boxSizing: "border-box",
      overflowX: "hidden",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      [theme.breakpoints.up("md")]: {
        padding: theme.spacing(2, 2, 2.5),
        alignItems: "center"
      },
      [theme.breakpoints.down("sm")]: {
        height: "auto",
        minHeight: "100dvh",
        padding: theme.spacing(1.5, 1.5, 2.5),
        paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))"
      },
      [theme.breakpoints.down("xs")]: {
        padding: theme.spacing(1, 1.25, 2),
        paddingTop: "max(8px, env(safe-area-inset-top, 0px))"
      }
    },
    container: {
      width: "100%",
      maxWidth: 420,
      position: "relative",
      padding: 0,
      boxSizing: "border-box",
      margin: "0 auto",
      [theme.breakpoints.down("sm")]: {
        maxWidth: "100%"
      }
    },
    contentWrap: {
      width: "100%",
      marginTop: 0,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch"
    },
    langRow: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      width: "100%",
      marginBottom: theme.spacing(1),
      paddingRight: 2,
      position: "relative",
      zIndex: 30
    },
    formFieldsWrap: {
      width: "100%",
      padding: theme.spacing(2.25, 2.5, 2),
      boxSizing: "border-box",
      background: "#ffffff",
      borderRadius: 14,
      border: "1px solid rgba(0, 0, 0, 0.08)",
      boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
      color: textColor,
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(2.25, 2, 2)
      },
      [theme.breakpoints.down("xs")]: {
        padding: theme.spacing(2, 1.5, 1.75),
        borderRadius: 12,
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.05)"
      }
    },
    formLogoWrap: {
      display: "flex",
      justifyContent: "center",
      marginBottom: theme.spacing(1)
    },
    formLogo: {
      height: 72,
      width: "auto",
      maxWidth: "min(260px, 72%)",
      objectFit: "contain",
      [theme.breakpoints.down("xs")]: {
        height: 64,
        maxWidth: "78%"
      }
    },
    title: {
      fontWeight: 700,
      fontSize: 18,
      fontFamily: CLICKUP_FONT,
      letterSpacing: "-0.022em",
      marginBottom: theme.spacing(0.35),
      textAlign: "center",
      color: `${textColor} !important`,
      lineHeight: 1.25,
      [theme.breakpoints.down("xs")]: {
        fontSize: 17
      }
    },
    subtitle: {
      color: `${mutedColor} !important`,
      fontSize: 12.5,
      fontFamily: CLICKUP_FONT,
      textAlign: "center",
      marginBottom: theme.spacing(1.5),
      lineHeight: 1.4,
      [theme.breakpoints.down("xs")]: {
        fontSize: 12,
        marginBottom: theme.spacing(1.25)
      }
    },
    inputGroup: {
      border: "none",
      borderRadius: 12,
      padding: theme.spacing(0.25, 0),
      background: "transparent",
      boxShadow: "none",
      fontFamily: CLICKUP_FONT,
      "& .MuiGrid-item": {
        paddingTop: theme.spacing(0.85),
        paddingBottom: theme.spacing(0.45)
      },
      "& .MuiOutlinedInput-root": {
        background: inputBg,
        borderRadius: 10,
        minHeight: 42,
        fontSize: 15,
        fontFamily: CLICKUP_FONT,
        color: textColor,
        transition: "background-color 0.2s ease, box-shadow 0.2s ease",
        "& fieldset": {
          border: "1px solid rgba(0,0,0,0.1)"
        },
        "&:hover": {
          background: inputBgHover,
          "& fieldset": {
            borderColor: "rgba(0,0,0,0.16)"
          }
        },
        "&.Mui-focused": {
          background: inputBgFocus,
          boxShadow: "0 0 0 3px rgba(30, 58, 138, 0.14)",
          outline: "none"
        },
        "&.Mui-focused fieldset": {
          borderColor: "#1e3a8a",
          borderWidth: 1.5
        }
      },
      "& .MuiOutlinedInput-notchedOutline": {
        borderWidth: "1px !important"
      },
      "& .MuiInputBase-input": {
        color: `${textColor} !important`,
        WebkitTextFillColor: textColor,
        caretColor: textColor,
        fontFamily: CLICKUP_FONT,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "-0.022em",
        padding: "11px 14px",
        "&::placeholder": {
          color: "#a1a1a6",
          opacity: 1
        }
      },
      "& .MuiFormHelperText-root": {
        fontFamily: CLICKUP_FONT,
        fontSize: 11.5,
        marginTop: 4,
        color: "#b91c1c"
      }
    },
    phoneField: {
      "& .MuiInputBase-input": {
        color: "#9ca3af !important",
        WebkitTextFillColor: "#9ca3af",
        fontWeight: 400,
        letterSpacing: "0.02em"
      },
      "& .MuiOutlinedInput-root.Mui-focused .MuiInputBase-input, & .MuiOutlinedInput-root:hover .MuiInputBase-input": {
        color: "#6b7280 !important",
        WebkitTextFillColor: "#6b7280"
      }
    },
    fieldLabel: {
      display: "block",
      color: `${labelColor} !important`,
      fontFamily: CLICKUP_FONT,
      fontSize: 12,
      fontWeight: 650,
      letterSpacing: "-0.022em",
      marginBottom: 6,
      lineHeight: 1.25
    },
    submit: {
      marginTop: theme.spacing(1.5),
      minHeight: 42,
      width: "100%",
      borderRadius: 10,
      textTransform: "none",
      fontWeight: 600,
      fontFamily: CLICKUP_FONT,
      fontSize: 15,
      letterSpacing: "-0.01em",
      background: "#1e3a8a",
      color: "#fff",
      boxShadow: "none",
      "&:hover": {
        background: "#1e40af",
        boxShadow: "none"
      },
      "&.Mui-disabled": { opacity: 0.55 }
    },
    backLink: {
      display: "block",
      textAlign: "center",
      marginTop: theme.spacing(1.5),
      color: mutedColor,
      fontSize: 12.5,
      fontFamily: CLICKUP_FONT,
      textDecoration: "none",
      fontWeight: 500,
      "&:hover": { color: textColor }
    }
  };
});

const phoneDigits = value => String(value || "").replace(/\D/g, "");

/** Normaliza para WhatsApp BR: 55 + DDD + número (12 ou 13 dígitos). */
const normalizeWhatsAppPhone = value => {
  let d = phoneDigits(value);
  if (!d) return "";
  if (d.startsWith("055")) d = d.slice(1);
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) {
    d = `55${d}`;
  }
  return d;
};

const RegisterTesteGratis = () => {
  const classes = useStyles();
  const { t } = useAppTranslation();
  const { applyLoginSession, handleLogin } = useContext(AuthContext);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const SignupSchema = useMemo(
    () =>
      Yup.object().shape({
        phone: Yup.string()
          .required(t("freeTrialRegister.phoneRequired"))
          .test("phone", t("freeTrialRegister.phoneInvalid"), v => {
            const d = normalizeWhatsAppPhone(v);
            return d.length === 12 || d.length === 13;
          }),
        email: Yup.string()
          .email(t("freeTrialRegister.emailInvalid"))
          .required(t("freeTrialRegister.emailRequired")),
        password: Yup.string()
          .min(5, t("freeTrialRegister.passwordMin"))
          .required(t("freeTrialRegister.passwordRequired")),
        passwordConfirm: Yup.string()
          .oneOf([Yup.ref("password"), null], t("freeTrialRegister.passwordMismatch"))
          .required(t("freeTrialRegister.passwordConfirmRequired"))
      }),
    [t]
  );

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      const payload = {
        phone: normalizeWhatsAppPhone(values.phone),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        passwordConfirm: values.passwordConfirm
      };

      const { data } = await openApi.post("/auth/signup/teste-gratis", payload, {
        withCredentials: true
      });

      if (data?.token && data?.user) {
        toast.success(t("freeTrialRegister.success"));
        if (typeof applyLoginSession === "function") {
          await applyLoginSession({
            token: data.token,
            user: data.user
          });
          return;
        }
        if (typeof handleLogin === "function") {
          await handleLogin({
            email: payload.email,
            password: payload.password
          });
          return;
        }
        localStorage.setItem("token", JSON.stringify(data.token));
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        window.location.href = "/tickets";
        return;
      }

      toastError(t("freeTrialRegister.fail"));
    } catch (err) {
      const msg = String(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          ""
      );
      if (err?.response?.status === 409 || /e-mail|email|cadastrado/i.test(msg)) {
        setFieldError("email", t("freeTrialRegister.emailTaken"));
      }
      if (/telefone/i.test(msg)) {
        setFieldError("phone", t("freeTrialRegister.phoneTaken"));
      }
      toastError(err);
    } finally {
      submittingRef.current = false;
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <Box className={classes.root} component="main">
      <Box className={classes.container}>
        <Box className={classes.contentWrap}>
          <Box className={classes.langRow}>
            <MinimalLanguageSelector variant="light" inline compact />
          </Box>
          <Formik
            initialValues={{
              phone: "",
              email: "",
              password: "",
              passwordConfirm: ""
            }}
            validationSchema={SignupSchema}
            onSubmit={handleSubmit}
            enableReinitialize={false}
          >
            {({ touched, errors, isSubmitting, values, setFieldValue, setFieldTouched }) => (
              <Form noValidate aria-label={t("freeTrialRegister.title")}>
                <Box className={classes.formFieldsWrap}>
                  <Box className={classes.formLogoWrap}>
                    <img
                      src={logoVBBlack}
                      alt="VB Solution"
                      className={classes.formLogo}
                    />
                  </Box>
                  <Typography className={classes.title} component="h1">
                    {t("freeTrialRegister.title")}
                  </Typography>
                  <Typography className={classes.subtitle} component="p">
                    {t("freeTrialRegister.subtitle")}
                  </Typography>

                  <Grid container spacing={1} className={classes.inputGroup}>
                    <Grid item xs={12}>
                      <InputLabel className={classes.fieldLabel} htmlFor="ft-phone">
                        {t("freeTrialRegister.phone")}
                      </InputLabel>
                      <NumberFormat
                        id="ft-phone"
                        customInput={TextField}
                        format={PHONE_FORMAT}
                        mask="_"
                        value={values.phone}
                        onValueChange={v => {
                          setFieldValue("phone", v.value || "");
                        }}
                        onBlur={() => setFieldTouched("phone", true)}
                        variant="outlined"
                        fullWidth
                        type="tel"
                        className={classes.phoneField}
                        inputProps={{
                          inputMode: "tel",
                          "aria-label": t("freeTrialRegister.phone"),
                          autoComplete: "tel"
                        }}
                        error={touched.phone && Boolean(errors.phone)}
                        helperText={touched.phone && errors.phone}
                        placeholder="+55 (11) 99999-9999"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <InputLabel className={classes.fieldLabel}>
                        {t("freeTrialRegister.email")}
                      </InputLabel>
                      <Field
                        as={TextField}
                        name="email"
                        type="email"
                        variant="outlined"
                        fullWidth
                        inputProps={{
                          "aria-label": t("freeTrialRegister.email"),
                          autoComplete: "email"
                        }}
                        error={touched.email && Boolean(errors.email)}
                        helperText={touched.email && errors.email}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <InputLabel className={classes.fieldLabel}>
                        {t("freeTrialRegister.password")}
                      </InputLabel>
                      <Field
                        as={TextField}
                        name="password"
                        type="password"
                        variant="outlined"
                        fullWidth
                        inputProps={{
                          "aria-label": t("freeTrialRegister.password"),
                          autoComplete: "new-password"
                        }}
                        error={touched.password && Boolean(errors.password)}
                        helperText={touched.password && errors.password}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <InputLabel className={classes.fieldLabel}>
                        {t("freeTrialRegister.passwordConfirm")}
                      </InputLabel>
                      <Field
                        as={TextField}
                        name="passwordConfirm"
                        type="password"
                        variant="outlined"
                        fullWidth
                        inputProps={{
                          "aria-label": t("freeTrialRegister.passwordConfirm"),
                          autoComplete: "new-password"
                        }}
                        error={
                          touched.passwordConfirm &&
                          Boolean(errors.passwordConfirm)
                        }
                        helperText={
                          touched.passwordConfirm && errors.passwordConfirm
                        }
                      />
                    </Grid>
                  </Grid>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    className={classes.submit}
                    disabled={isSubmitting || loading}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      t("freeTrialRegister.submit")
                    )}
                  </Button>

                  <Typography
                    className={classes.backLink}
                    component={RouterLink}
                    to="/login"
                  >
                    {t("freeTrialRegister.hasAccount")}
                  </Typography>
                </Box>
              </Form>
            )}
          </Formik>
        </Box>
      </Box>
    </Box>
  );
};

export default RegisterTesteGratis;
