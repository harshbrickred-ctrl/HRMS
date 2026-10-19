import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import { enter, fadeTransition, loginEase } from "./login/motion";
import "./LoginPage.css";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "1";
  const reduce = useReducedMotion() === true;
  const [email, setEmail] = useState("admin@peopleos.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorTick, setErrorTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const busy = submitting || loading;

  useEffect(() => {
    if (!error) return;
    alertRef.current?.focus();
  }, [error, errorTick]);

  if (!loading && user) {
    return <Navigate to="/ess" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/ess", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setErrorTick((tick) => tick + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const frame = enter(reduce, 0);
  const submitArrive = enter(reduce, 6);

  return (
    <div className="login-page">
      <div className="login-tools">
        <ThemeToggle />
      </div>

      <motion.main
        className="login-frame"
        initial={frame.initial}
        animate={frame.animate}
        transition={frame.transition}
      >
        <div className="login-grid">
          <header className="login-identity">
            <motion.p className="login-eyebrow" {...enter(reduce, 1)}>
              Internal workspace
            </motion.p>
            <motion.h1 className="login-name" {...enter(reduce, 1)}>
              PeopleOS
            </motion.h1>
            <motion.p className="login-sentence" {...enter(reduce, 2)}>
              Sign in with your work email to open your workspace.
            </motion.p>
            <motion.dl className="login-scope" {...enter(reduce, 3)}>
              <div>
                <dt>Attendance</dt>
                <dd>Mark the day. Request a correction when it is wrong.</dd>
              </div>
              <div>
                <dt>Leave</dt>
                <dd>Apply, check balances, and see holidays.</dd>
              </div>
              <div>
                <dt>Approvals</dt>
                <dd>Managers decide from one inbox.</dd>
              </div>
            </motion.dl>
            <motion.p className="login-note" {...enter(reduce, 3)}>
              Your role adds the sections you are responsible for.
            </motion.p>
          </header>

          <div className="login-rule" aria-hidden="true" />

          <form className="login-form" onSubmit={onSubmit}>
            {resetSuccess ? (
              <div className="login-status" role="status">
                Password updated. Sign in with your new password.
              </div>
            ) : null}

            {error ? (
              <motion.div
                key={errorTick}
                ref={alertRef}
                className="login-alert"
                role="alert"
                tabIndex={-1}
                initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fadeTransition(reduce, 0.2)}
              >
                {error}
              </motion.div>
            ) : null}

            <motion.div className="login-field" {...enter(reduce, 4)}>
              <label className="login-label" htmlFor="login-email">
                Email
              </label>
              <div className="login-control">
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
            </motion.div>

            <motion.div className="login-field" {...enter(reduce, 5)}>
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="login-control">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword((open) => !open)}
                  disabled={busy}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="login-reveal-swap" aria-hidden="true">
                    <motion.span
                      animate={{ opacity: showPassword ? 0 : 1 }}
                      transition={fadeTransition(reduce)}
                    >
                      Show
                    </motion.span>
                    <motion.span
                      animate={{ opacity: showPassword ? 1 : 0 }}
                      transition={fadeTransition(reduce)}
                    >
                      Hide
                    </motion.span>
                  </span>
                </button>
              </div>
              <p className="login-forgot">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
            </motion.div>

            <motion.button
              className="login-submit"
              type="submit"
              disabled={busy}
              aria-busy={submitting}
              initial={submitArrive.initial}
              animate={submitArrive.animate}
              transition={{
                ...submitArrive.transition,
                scale: {
                  type: "tween",
                  duration: reduce ? 0 : 0.12,
                  ease: loginEase,
                  delay: 0,
                },
              }}
              whileTap={reduce || busy ? undefined : { scale: 0.985 }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>
        </div>
      </motion.main>
    </div>
  );
}
