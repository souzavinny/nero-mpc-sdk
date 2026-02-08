import type { User } from "../../types";
import { useNeroMpcAuthContext } from "../context";

export interface UseNeroUserReturn {
	user: User | null;
	isAuthenticated: boolean;
}

export function useNeroUser(): UseNeroUserReturn {
	const { state } = useNeroMpcAuthContext();

	return {
		user: state.user,
		isAuthenticated: state.isAuthenticated,
	};
}
