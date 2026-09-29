'use client'

import { useState } from 'react'
import { Layout, Menu, Button, Drawer, theme, Grid } from 'antd'
import { Home } from 'lucide-react'
import {
  DashboardOutlined,
  WalletOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const { Sider, Content, Header } = Layout
const { useBreakpoint } = Grid

const navItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/expenses', icon: <WalletOutlined />, label: 'Expenses' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { token } = theme.useToken()
  const screens = useBreakpoint()
  const supabase = createClient()
  const isMobile = screens.md === false

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const activeKey = navItems.find(item => pathname.startsWith(item.key))?.key ?? '/dashboard'

  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        {/* Mobile top bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
              style={{ width: 40, height: 40 }}
            />
            <img src="/homie_logo.png" alt="Homie" style={{ height: 44 }} />
          </div>
        </header>

        <Content style={{ padding: 16, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          {children}
        </Content>

        {/* Hamburger Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size="default"
          styles={{ body: { padding: 0 } }}
          title={<img src="/homie_logo.png" alt="Homie" style={{ height: 36 }} />}
        >
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            style={{ border: 'none', marginTop: 8 }}
            items={navItems.map(item => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              onClick: () => { router.push(item.key); setDrawerOpen(false) },
            }))}
          />
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 12px' }}>
            <Button icon={<LogoutOutlined />} block type="text" danger onClick={handleLogout} style={{ textAlign: 'left' }}>
              Sign Out
            </Button>
          </div>
        </Drawer>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={220}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {collapsed ? <Home size={20} /> : <img src="/homie_logo.png" alt="Homie" style={{ height: 52 }} />}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          style={{ border: 'none', marginTop: 8 }}
          items={navItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => router.push(item.key),
          }))}
        />

        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          padding: '0 12px',
        }}>
          <Button icon={<LogoutOutlined />} block type="text" danger onClick={handleLogout} style={{ textAlign: 'left' }}>
            {!collapsed && 'Sign Out'}
          </Button>
        </div>
      </Sider>

      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Header>

        <Content style={{ padding: 24, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
