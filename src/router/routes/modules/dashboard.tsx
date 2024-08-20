import { Suspense, lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { SvgIcon } from '@/components/icon';
import { CircleLoading } from '@/components/loading';

import { AppRouteObject } from '#/router';

const HomePage = lazy(() => import(`@/pages/dashboard/workbench`));
const EquipmentAnalysis = lazy(() => import('@/pages/dashboard/equipment_analysis'));
const PortAnalysis = lazy(() => import('@/pages/dashboard/port_analysis'));

const dashboard: AppRouteObject = {
  order: 1,
  path: 'dashboard',
  element: (
    <Suspense fallback={<CircleLoading />}>
      <Outlet />
    </Suspense>
  ),
  meta: {
    label: 'sys.menu.dashboard',
    icon: <SvgIcon icon="ic-analysis" className="ant-menu-item-icon" size="24" />,
    key: '/dashboard',
  },
  children: [
    {
      index: true,
      element: <Navigate to="workbench" replace />,
    },
    {
      path: 'workbench',
      element: <HomePage />,
      meta: { label: 'sys.menu.workbench', key: '/dashboard/workbench' },
    },
    {
      path: 'equipment_analysis',
      element: <EquipmentAnalysis />,
      meta: { label: 'sys.menu.equipmentAnalysis', key: '/dashboard/equipment_analysis' },
    },
    {
      path: 'port_analysis',
      element: <PortAnalysis />,
      meta: { label: 'sys.menu.portAnalysis', key: '/dashboard/port_analysis' },
    },
  ],
};

export default dashboard;
