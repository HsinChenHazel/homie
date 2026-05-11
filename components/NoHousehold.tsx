'use client'

import { Card, Empty, Typography } from 'antd'
import Link from 'next/link'
import { Button } from 'antd'

const { Title, Text } = Typography

export default function NoHousehold() {
  return (
    <div>
      <Title level={2}>Welcome to Homie</Title>
      <Card>
        <Empty
          description="You're not in a household yet."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Text style={{ display: 'block', marginBottom: 16 }}>
            Create one or join an existing household to get started.
          </Text>
          <Link href="/settings">
            <Button type="primary">Go to Settings</Button>
          </Link>
        </Empty>
      </Card>
    </div>
  )
}
