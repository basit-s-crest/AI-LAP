// "use client";

// import { useMutation } from "@tanstack/react-query";
// import { useRouter } from "next/navigation";
// import { useAppDispatch } from "@/hooks/redux";
// import { setSession } from "@/store/slices/authSlice";
// import { authService } from "@/services/auth.service";
// import type { LoginCredentials } from "@/types/auth";
// import type { Role } from "@/types/role";

// function getRedirectPathForRole(role: Role): string {
//   switch (role) {
//     case "superadmin":
//       return "/dashboard/admin";
//     case "coach":
//       return "/dashboard/coach";
//     case "user":
//       return "/dashboard/member";
//     case "organization":
//       return "/dashboard/org";
//     default:
//       return "/dashboard";
//   }
// }

// export function useLogin() {
//   const dispatch = useAppDispatch();
//   const router = useRouter();

//   return useMutation({
//     mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
//     onSuccess: (session) => {
//       // Persist to localStorage (vasl_ keys as specified)
//       localStorage.setItem("vasl_token", session.token);
//       localStorage.setItem("vasl_user", JSON.stringify(session.user));

//       // Sync to Redux + cookies (via authSlice.setSession)
//       dispatch(setSession(session));

//       // Role-based redirect
//       router.push(getRedirectPathForRole(session.user.role));
//     },
//     onError: (error: Error) => {
//       return error.message;
//     },
//   });
// }
"use client";
 
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useDispatch } from "react-redux";
import type { Role } from "@/types/role";
import { setSession } from "@/store/slices/authSlice";
 
interface LoginData {

  email: string;
  password: string;

}
 
interface LoginResponse {

  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;

  };

  token: string;

}
 
export function useLogin() {

  const dispatch = useDispatch();

  return useMutation({

    mutationFn: async (data: LoginData): Promise<LoginResponse> => {

      const response = await api.post("/auth/login", data);

      return response.data;

    },

  onSuccess: (data) => {
    localStorage.setItem("vasl_token", data.token);
 
  // Split name into firstName and lastName for the existing AuthUser type
    const [firstName, ...rest] = data.user.name.split(" ");
    const lastName = rest.join(" ") || "";
 
    const user = { ...data.user, firstName, lastName, role: data.user.role as Role };
 
    dispatch(setSession({ user, token: data.token }));
  },

    onError: (error: any) => {

      const message =

        error?.response?.data?.message || "Invalid email or password";

      throw new Error(message);

    },

  });

}
 