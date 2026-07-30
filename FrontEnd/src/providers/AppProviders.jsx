import { TurnkeyProvider } from '@turnkey/react-wallet-kit'
import '@turnkey/react-wallet-kit/styles.css'
import {
  isTurnkeyConfigured,
  TURNKEY_AUTH_PROXY_CONFIG_ID,
  TURNKEY_ORGANIZATION_ID,
} from '../config'

const turnkeyConfig = {
  organizationId: TURNKEY_ORGANIZATION_ID,
  authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID,
  auth: {
    autoRefreshSession: true,
  },
  ui: {
    darkMode: false,
    borderRadius: '0px',
    authModal: {
      methods: {
        emailOtpAuthEnabled: true,
        passkeyAuthEnabled: true,
        walletAuthEnabled: false,
        smsOtpAuthEnabled: false,
        googleOauthEnabled: false,
        appleOauthEnabled: false,
        facebookOauthEnabled: false,
        xOauthEnabled: false,
        discordOauthEnabled: false,
      },
      methodOrder: ['email', 'passkey'],
    },
    colors: {
      light: {
        primary: '#00C587',
        primaryText: '#2C2A29',
      },
    },
  },
}

export function AppProviders({ children }) {
  if (!isTurnkeyConfigured) {
    return children
  }

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: (error) => {
          console.error('Turnkey error:', error)
        },
      }}
    >
      {children}
    </TurnkeyProvider>
  )
}
