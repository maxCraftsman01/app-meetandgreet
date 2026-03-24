import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Loader2 } from "lucide-react";
import { validatePin } from "@/lib/api";
import { setSession, getSession } from "@/lib/session";

const Index = () => {
  const [digits, setDigits] = useState<string[]>(Array(8).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const session = getSession();
    if (session?.role === "admin") navigate("/admin");
    else if (session?.role === "user") navigate("/dashboard");
  }, [navigate]);

  useEffect(() => {
    const pin = searchParams.get("pin");
    if (pin && pin.length === 8) {
      const newDigits = pin.split("");
      setDigits(newDigits);
      handleSubmit(newDigits.join(""));
    } else {
      inputRefs.current[0]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    
    if (value.length > 1) {
      const pasted = value.slice(0, 8 - index).split("");
      pasted.forEach((d, i) => {
        if (index + i < 8) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      const next = Math.min(index + pasted.length, 7);
      inputRefs.current[next]?.focus();
      if (newDigits.every((d) => d !== "")) {
        handleSubmit(newDigits.join(""));
      }
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);
    setError("");

    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== "")) {
      handleSubmit(newDigits.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (pin: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await validatePin(pin);
      if (result.role === "admin") {
        setSession({ role: "admin", pin });
        navigate("/admin");
      } else {
        setSession({
          role: "user",
          pin,
          user_id: result.user_id,
          user_name: result.user_name,
          properties: result.properties,
        });
        navigate("/dashboard");
      }
    } catch {
      setError("Invalid PIN. Please try again.");
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setDigits(Array(8).fill(""));
        inputRefs.current[0]?.focus();
      }, 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center gap-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center"
          >
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </motion.div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Welcome to Cura
            </h1>
            <p className="text-lg font-medium text-foreground">
              MeetAndGreet
            </p>
            <p className="text-muted-foreground text-sm">
              by MeetAndGreet
            </p>
          </div>

          <div
            className={`flex gap-2 sm:gap-3 ${shake ? "animate-pin-shake" : ""}`}
          >
            {digits.map((digit, i) => (
              <motion.input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04, duration: 0.4 }}
                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg font-mono font-medium rounded-lg border-2 border-border bg-card focus:border-foreground focus:outline-none transition-colors duration-150"
                disabled={loading}
              />
            ))}
          </div>

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-muted-foreground text-sm"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </motion.div>
            )}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-destructive text-sm font-medium"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <p className="absolute bottom-4 text-[10px] text-muted-foreground/60">
        Developed by <a href="https://whereismax.pl" target="_blank" rel="noopener noreferrer" className="underline text-inherit">MaxCraftsman</a> for <a href="https://meetandgreet.expert" target="_blank" rel="noopener noreferrer" className="underline text-inherit">MeetAndGreet</a>
      </p>
    </div>
  );
};

export default Index;
