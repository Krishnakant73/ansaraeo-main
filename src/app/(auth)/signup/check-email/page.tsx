import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div className="container-x relative flex min-h-screen items-center justify-center py-24 text-center">
      <Link
        href="/"
        className="absolute left-5 top-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink md:left-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      <div className="card max-w-md p-8 hover:!translate-y-0 hover:!scale-100">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
          <Mail className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ve sent a confirmation link to your inbox. Click it to activate your account, then log in.
        </p>
        <p className="mt-4 text-xs text-muted">
          Don&apos;t see it? Check your spam folder, or try{" "}
          <Link href="/signup" className="font-medium text-accent">
            signing up again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
