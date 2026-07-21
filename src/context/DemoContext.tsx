'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'employee' | 'manager' | 'admin';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface DemoContextType {
  activeUser: User;
  switchRole: (role: UserRole) => void;
  usersList: User[];
}

const DEMO_USERS: User[] = [
  { id: 'user-employee', name: 'Rahul Verma', email: 'rahul@apextech.com', role: 'employee' },
  { id: 'user-manager', name: 'Anjali Sharma', email: 'anjali@apextech.com', role: 'manager' },
  { id: 'user-admin', name: 'Tejpratap Singh', email: 'tej@apextech.com', role: 'admin' },
];

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [activeUser, setActiveUser] = useState<User>(DEMO_USERS[0]);

  const switchRole = (role: UserRole) => {
    const user = DEMO_USERS.find((u) => u.role === role);
    if (user) {
      setActiveUser(user);
    }
  };

  return (
    <DemoContext.Provider value={{ activeUser, switchRole, usersList: DEMO_USERS }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
