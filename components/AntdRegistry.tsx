'use client'

import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs'
import { App, ConfigProvider } from 'antd'
import { useServerInsertedHTML } from 'next/navigation'
import { useState } from 'react'

export default function AntdRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => createCache())

  useServerInsertedHTML(() => (
    <style
      id="antd"
      dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
    />
  ))

  return (
    <StyleProvider cache={cache}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#4361EE',
            colorLink: '#4361EE',
            borderRadius: 8,
          },
        }}
      >
        <App message={{ duration: 3, maxCount: 3 }}>{children}</App>
      </ConfigProvider>
    </StyleProvider>
  )
}
