import React from 'react'
import { Box, Typography, Container } from '@mui/material'

const Operations = () => {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: '#0f172a',
            textAlign: 'center'
          }}
        >
          Coming Soon
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: '#64748b',
            textAlign: 'center',
            fontSize: '1rem'
          }}
        >
          We're working on bringing you this feature
        </Typography>
      </Box>
    </Container>
  )
}

export default Operations