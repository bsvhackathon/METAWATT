/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * src/App.tsx
 *
 * Changes:
 *  - Removed the usage table from the My Certificates tab
 *  - Updated charts to use blues & greens
 */
import React, { useState, useEffect, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  LinearProgress,
  IconButton
} from '@mui/material'
import Box from '@mui/material/Box'
import { styled } from '@mui/system'
import GitHubIcon from '@mui/icons-material/GitHub'
import useAsyncEffect from 'use-async-effect'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

import NoMncModal from './components/NoMncModal/NoMncModal'
import { WalletClient, PushDrop, Utils, Transaction, LockingScript, type WalletOutput, Beef } from '@bsv/sdk'
import checkForMetaNetClient from './utils/checkForMetaNetClient'
import { type Certificate } from './types/types'
import './App.scss'
import { Services } from '@bsv/wallet-toolbox-client'

const METAWATT_PROTO_ADDR = '1METAWATTCertificateTokenProtocolxyz'

const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em 0'
})

const GitHubIconStyle = styled(IconButton)({
  color: '#ffffff'
})

const walletClient = new WalletClient()

//
// Mock data for Recharts
//

// Line chart data: daily availability of resources by time (using blues & greens)
const energyAvailabilityData = [
  { time: '6 AM', Solar: 30, Wind: 10, Hydro: 5 },
  { time: '9 AM', Solar: 60, Wind: 20, Hydro: 12 },
  { time: '12 PM', Solar: 90, Wind: 28, Hydro: 18 },
  { time: '3 PM', Solar: 70, Wind: 25, Hydro: 15 },
  { time: '6 PM', Solar: 20, Wind: 30, Hydro: 25 }
]

// Pie chart data: usage by resource type (using blues & greens)
const usageResourceData = [
  { name: 'Solar', value: 160 },
  { name: 'Wind', value: 80 },
  { name: 'Hydro', value: 40 },
  { name: 'Biomass', value: 20 }
]

// Colors for the pie chart slices, all in a blue-green palette
const usageColors = ['#4A90E2', '#50E3C2', '#7ED321', '#B8E986']

//
// Hardcoded renewable energy certificates (six total)
//
const marketplaceCertificates = [
  {
    id: 'cert-001',
    source: 'Solar Farm A',
    location: 'Arizona, USA',
    amount: '100 kWh',
    date: '2025-03-15',
    price: 1000
  },
  {
    id: 'cert-002',
    source: 'Wind Farm B',
    location: 'Texas, USA',
    amount: '250 kWh',
    date: '2025-03-20',
    price: 2000
  },
  {
    id: 'cert-003',
    source: 'Hydro Plant C',
    location: 'Washington, USA',
    amount: '500 kWh',
    date: '2025-03-25',
    price: 5000
  },
  {
    id: 'cert-004',
    source: 'Solar Farm D',
    location: 'California, USA',
    amount: '300 kWh',
    date: '2025-04-01',
    price: 1500
  },
  {
    id: 'cert-005',
    source: 'Wind Farm E',
    location: 'New Mexico, USA',
    amount: '400 kWh',
    date: '2025-04-05',
    price: 2500
  },
  {
    id: 'cert-006',
    source: 'Hydro Plant F',
    location: 'Oregon, USA',
    amount: '800 kWh',
    date: '2025-04-10',
    price: 6000
  }
]

const App: React.FC = () => {
  // Tabs: 0 => Marketplace, 1 => My Certificates
  const [tabValue, setTabValue] = useState(0)
  const handleTabChange = (_: React.SyntheticEvent, newVal: number) => {
    setTabValue(newVal)
  }

  const [isMncMissing, setIsMncMissing] = useState<boolean>(false)
  const [buyLoading, setBuyLoading] = useState<boolean>(false)
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [certificatesLoading, setCertificatesLoading] = useState<boolean>(true)
  const [claimOpen, setClaimOpen] = useState<boolean>(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const [claimLoading, setClaimLoading] = useState<boolean>(false)

  // Check if the MetaNet Client is installed
  useAsyncEffect(() => {
    const intervalId = setInterval(() => {
      checkForMetaNetClient()
        .then(hasMNC => {
          if (hasMNC === 0) setIsMncMissing(true)
          else {
            setIsMncMissing(false)
            clearInterval(intervalId)
          }
        })
        .catch(error => console.error('Error checking for MetaNet Client:', error))
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  // Create a new METAWATT certificate token (purchase a certificate)
  const handleBuyCertificate = async (certId: string): Promise<void> => {
    try {
      const cert = marketplaceCertificates.find(c => c.id === certId)
      if (!cert) {
        toast.error('Certificate not found!')
        return
      }
      setBuyLoading(true)
      setSelectedCertId(certId)

      const certData = JSON.stringify(cert)
      const encryptedCert = (await walletClient.encrypt({
        plaintext: Utils.toArray(certData, 'utf8'),
        protocolID: [0, 'metawatt'],
        keyID: '1'
      })).ciphertext

      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [Utils.toArray(METAWATT_PROTO_ADDR, 'utf8') as number[], encryptedCert],
        [0, 'metawatt'],
        '1',
        'self'
      )

      const newCertificateToken = await walletClient.createAction({
        outputs: [
          {
            lockingScript: bitcoinOutputScript.toHex(),
            satoshis: cert.price,
            basket: 'metawatt certificates',
            outputDescription: `Renewable Energy Certificate: ${cert.source} - ${cert.amount}`
          }
        ],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Purchase Renewable Energy Certificate: ${cert.source} - ${cert.amount}`
      })

      toast.dark('Certificate purchased successfully!')
      setCertificates(prev => [
        {
          certData: cert,
          sats: cert.price,
          outpoint: `${newCertificateToken.txid}.0`,
          lockingScript: bitcoinOutputScript.toHex(),
          beef: newCertificateToken.tx
        },
        ...prev
      ])
    } catch (e) {
      toast.error((e as Error).message)
      console.error(e)
    } finally {
      setBuyLoading(false)
      setSelectedCertId(null)
    }
  }

  // Claim a certificate and get satoshis back
  const handleClaimSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    try {
      setClaimLoading(true)
      if (!selectedCertificate) throw new Error('No certificate selected')

      let description = `Claim Certificate: ${selectedCertificate.certData.source} - ${selectedCertificate.certData.amount}`
      if (description.length > 128) description = description.substring(0, 128)

      const loadedBeef = Beef.fromBinary(selectedCertificate.beef as number[])
      await loadedBeef.verify(await new Services('main').getChainTracker(), true)

      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: loadedBeef.toBinary(),
        inputs: [
          {
            inputDescription: 'Claim Certificate',
            outpoint: selectedCertificate.outpoint,
            unlockingScriptLength: 73
          }
        ],
        options: {
          randomizeOutputs: false
        }
      })
      if (!signableTransaction) throw new Error('Failed to create signable transaction')

      const partialTx = Transaction.fromBEEF(signableTransaction.tx)
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'metawatt'],
        '1',
        'self',
        'all',
        false,
        selectedCertificate.sats,
        LockingScript.fromHex(selectedCertificate.lockingScript)
      )
      const unlockingScript = await unlocker.sign(partialTx, 0)

      await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: { unlockingScript: unlockingScript.toHex() }
        }
      })

      toast.dark('Certificate claimed successfully! 🎉')
      setCertificates(oldCerts => {
        const idx = oldCerts.findIndex(c => c === selectedCertificate)
        if (idx > -1) oldCerts.splice(idx, 1)
        return [...oldCerts]
      })
      setSelectedCertificate(null)
      setClaimOpen(false)
    } catch (error) {
      toast.error(`Error claiming certificate: ${(error as Error).message}`)
      console.error(error)
    } finally {
      setClaimLoading(false)
    }
  }

  // Load existing certificates from the wallet
  useEffect(() => {
    void (async () => {
      try {
        const certsFromBasket = await walletClient.listOutputs({
          basket: 'metawatt certificates',
          include: 'entire transactions'
        })

        const decryptedCertsResults = await Promise.all(
          certsFromBasket.outputs.map(async (cert: WalletOutput, i: number) => {
            try {
              const txid = cert.outpoint.split('.')[0]
              const tx = Transaction.fromBEEF(certsFromBasket.BEEF as number[], txid)
              if (!tx) return null

              const lockingScript = tx.outputs[0].lockingScript
              const decodedCert = PushDrop.decode(lockingScript)
              const encryptedCert = decodedCert.fields[1]

              const decryptedCertNumArray = await walletClient.decrypt({
                ciphertext: encryptedCert,
                protocolID: [0, 'metawatt'],
                keyID: '1'
              })
              const decryptedCertString = Utils.toUTF8(decryptedCertNumArray.plaintext)
              const certData = JSON.parse(decryptedCertString)

              return {
                lockingScript: lockingScript.toHex(),
                outpoint: `${txid}.${i}`,
                sats: cert.satoshis ?? 0,
                certData,
                beef: certsFromBasket.BEEF
              }
            } catch (err) {
              console.error('Error decrypting certificate:', err)
              return null
            }
          })
        )

        const decryptedCerts: Certificate[] = decryptedCertsResults.filter(
          (result): result is Certificate => result !== null
        )
        setCertificates(decryptedCerts.reverse())
      } catch (e) {
        const errorCode = (e as any).code
        if (errorCode !== 'ERR_NO_METANET_IDENTITY') {
          toast.error(`Failed to load certificates! Error: ${(e as Error).message}`)
          console.error(e)
        }
      } finally {
        setCertificatesLoading(false)
      }
    })()
  }, [])

  const openClaimModal = (cert: Certificate) => () => {
    setSelectedCertificate(cert)
    setClaimOpen(true)
  }

  return (
    <>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />
      <ToastContainer position='top-right' />

      <AppBar position='static'>
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            METAWATT — Renewable Energy Certificates
          </Typography>
          <GitHubIconStyle
            onClick={() => window.open('https://github.com/bsvhackathon/METAWATT', '_blank')}
          >
            <GitHubIcon />
          </GitHubIconStyle>
        </Toolbar>
      </AppBar>
      <AppBar position='static'>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor='secondary'
          textColor='inherit'
        >
          <Tab label='Marketplace' />
          <Tab label='My Certificates' />
        </Tabs>
      </AppBar>
      <AppBarPlaceholder />

      {/* Tab 0: Marketplace */}
      {tabValue === 0 && (
        <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant='h4' gutterBottom>
              Marketplace
            </Typography>

            {/* Recharts line chart for energy availability with blues & greens */}
            <Typography variant='h6' sx={{ mb: 2 }}>
              Mock Energy Availability (by resource & time of day)
            </Typography>
            <Box sx={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={energyAvailabilityData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='time' />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {/* Blues & Greens for lines */}
                  <Line type='monotone' dataKey='Solar' stroke='#4A90E2' strokeWidth={2} />
                  <Line type='monotone' dataKey='Wind' stroke='#50E3C2' strokeWidth={2} />
                  <Line type='monotone' dataKey='Hydro' stroke='#7ED321' strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            {/* Certificates for sale */}
            <Grid container spacing={3} sx={{ mt: 3 }}>
              {marketplaceCertificates.map((cert) => (
                <Grid item xs={12} sm={6} md={4} key={cert.id}>
                  <Card variant='outlined'>
                    <CardContent>
                      <Typography variant='h5' gutterBottom>
                        {cert.source}
                      </Typography>
                      <Typography>Location: {cert.location}</Typography>
                      <Typography>Amount: {cert.amount}</Typography>
                      <Typography>Date: {cert.date}</Typography>
                      <Typography>Price: {cert.price} satoshis</Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        variant='contained'
                        color='primary'
                        disabled={buyLoading && selectedCertId === cert.id}
                        onClick={() => {
                          void handleBuyCertificate(cert.id)
                        }}
                      >
                        {buyLoading && selectedCertId === cert.id ? 'Processing...' : 'Buy Certificate'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Container>
      )}

      {/* Tab 1: My Certificates */}
      {tabValue === 1 && (
        <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
          {/* Pie Chart: usage distribution by resource type (blue & green palette) */}
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant='h4' gutterBottom>
              Usage by Resource Type
            </Typography>
            <Box sx={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={usageResourceData}
                    dataKey='value'
                    nameKey='name'
                    outerRadius={100}
                    fill='#4A90E2'
                    label
                  >
                    {usageResourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={usageColors[index % usageColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* My Certificates Section */}
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant='h4' gutterBottom>
              My Certificates
            </Typography>
            {certificatesLoading ? (
              <LoadingBar />
            ) : certificates.length === 0 ? (
              <Typography sx={{ mt: 2 }} color='textSecondary'>
                You currently have no certificates. Purchase one from the Marketplace.
              </Typography>
            ) : (
              <List>
                {certificates.map((cert, i) => (
                  <ListItem key={i} button onClick={openClaimModal(cert)}>
                    <ListItemIcon>
                      <Checkbox checked={false} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${cert.certData.source} - ${cert.certData.amount}`}
                      secondary={`${cert.sats} satoshis • Click to claim`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Container>
      )}

      {/* Claim Certificate Dialog */}
      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleClaimSubmit(e)
          }}
        >
          <DialogTitle>Claim Certificate</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              Are you sure you want to claim this certificate? You'll receive back your{' '}
              {selectedCertificate?.sats} satoshis.
            </DialogContentText>
            {selectedCertificate && (
              <>
                <Typography variant='subtitle1'>
                  Source: {selectedCertificate.certData.source}
                </Typography>
                <Typography variant='subtitle1'>
                  Amount: {selectedCertificate.certData.amount}
                </Typography>
                <Typography variant='subtitle1'>
                  Location: {selectedCertificate.certData.location}
                </Typography>
                <Typography variant='subtitle1'>
                  Date: {selectedCertificate.certData.date}
                </Typography>
              </>
            )}
          </DialogContent>
          {claimLoading ? (
            <LoadingBar />
          ) : (
            <DialogActions>
              <Button onClick={() => setClaimOpen(false)}>Cancel</Button>
              <Button type='submit' variant='contained' color='primary'>
                Claim Certificate
              </Button>
            </DialogActions>
          )}
        </form>
      </Dialog>
    </>
  )
}

export default App
