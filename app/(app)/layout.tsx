'use client'

import { useState } from 'react'
import { Layout, Menu, Button, Typography, Grid, theme } from 'antd'
import { Home } from 'lucide-react'
import {
  DashboardOutlined,
  WalletOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const { Sider, Content, Header } = Layout
const { Text } = Typography
const { useBreakpoint } = Grid

const navItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/expenses', icon: <WalletOutlined />, label: 'Expenses' },
  { key: '/chores', icon: <CalendarOutlined />, label: 'Chores' },
  { key: '/grocery', icon: <ShoppingCartOutlined />, label: 'Grocery' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

const mobileNavItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Home' },
  { key: '/expenses', icon: <WalletOutlined />, label: 'Expenses' },
  { key: '/chores', icon: <CalendarOutlined />, label: 'Chores' },
  { key: '/grocery', icon: <ShoppingCartOutlined />, label: 'Grocery' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
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
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Home size={16} />
            <Text strong style={{ fontSize: 16 }}>Homie</Text>
          </div>
          <button
            onClick={() => router.push('/settings')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: activeKey === '/settings' ? '#4361EE' : token.colorTextSecondary,
              display: 'flex', alignItems: 'center', fontSize: 18,
            }}
          >
            <SettingOutlined />
          </button>
        </header>

        <Content style={{ padding: 16, paddingBottom: 80, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          {children}
        </Content>

        {/* Bottom nav with center + button */}
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 1000,
        }}>
          {mobileNavItems.slice(0, 2).map(item => {
            const active = activeKey === item.key
            return (
              <button key={item.key} onClick={() => router.push(item.key)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, border: 'none', background: 'none',
                cursor: 'pointer', color: active ? '#4361EE' : token.colorTextSecondary, padding: 0,
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </button>
            )
          })}

          {/* Center + button */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => router.push('/expenses?new=1')}
              style={{
                width: 48, height: 48,
                borderRadius: '50%',
                background: '#4361EE',
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(67,97,238,0.4)',
                marginBottom: 8,
              }}
            >
              +
            </button>
          </div>

          {mobileNavItems.slice(2).map(item => {
            const active = activeKey === item.key
            return (
              <button key={item.key} onClick={() => router.push(item.key)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, border: 'none', background: 'none',
                cursor: 'pointer', color: active ? '#4361EE' : token.colorTextSecondary, padding: 0,
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </button>
            )
          })}
        </nav>
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
          <Text strong style={{ fontSize: collapsed ? 20 : 18 }}>
            {collapsed ? <Home size={20} /> : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Home size={16} /> Homie</span>}
          </Text>
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
          <Button
            icon={<LogoutOutlined />}
            block
            type="text"
            danger
            onClick={handleLogout}
            style={{ textAlign: 'left' }}
          >
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
