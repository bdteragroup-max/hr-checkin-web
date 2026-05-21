import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/jwt";
import LoginPage from "./LoginPageClient";

export const dynamic = "force-dynamic";

export default async function Home() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (token) {
        try {
            const payload = verifyToken(token);
            if (payload && payload.emp_id) {
                redirect("/app");
            }
        } catch (e) {
            // Gracefully ignore expired or invalid JWT token and show LoginPage
        }
    }

    return <LoginPage />;
}