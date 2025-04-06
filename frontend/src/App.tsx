/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * src/App.tsx
 *
 * This file contains the primary business logic and UI code for the METAWATT
 * application for renewable energy certificates.
 */
import React, { useState, useEffect, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar, Toolbar, List, ListItem, ListItemText, ListItemIcon, Checkbox, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
  Button, Fab, LinearProgress, Typography, IconButton, Grid, Card, CardContent,
  CardActions
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import useAsyncEffect from 'use-async-effect'
import NoMncModal from './components/NoMncModal/NoMncModal'
import { WalletClient, PushDrop, Utils, Transaction, LockingScript, type WalletOutput, Beef, TransactionOutput, BeefTx } from '@bsv/sdk'
import checkForMetaNetClient from './utils/checkForMetaNetClient'
import { type Certificate } from './types/types'
// This stylesheet also uses this for themeing.
import './App.scss'
import { Services } from '@bsv/wallet-toolbox-client'

// This is the namespace address for the METAWATT protocol
// You can create your own Bitcoin address to use, and customize this protocol
// for your own needs.
const METAWATT_PROTO_ADDR = '1METAWATTCertificateTokenProtocolxyz'

// These are some basic styling rules for the React application.
// We are using MUI (https://mui.com) for all of our UI components (i.e. buttons and dialogs etc.).
const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Grid)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '5em'
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

const GitHubIconStyle = styled(IconButton)({
  color: '#ffffff'
})

const MarketplaceContainer = styled(Grid)({
  padding: '2em'
})

const CertificateCard = styled(Card)({
  margin: '1em',
  padding: '1em'
})

const walletClient = new WalletClient()

// Hardcoded renewable energy certificates for the marketplace
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
  }
]

const App: React.FC = () => {
  // These are some state variables that control the app's interface.
  const [isMncMissing, setIsMncMissing] = useState<boolean>(false)
  const [buyLoading, setBuyLoading] = useState<boolean>(false)
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [certificatesLoading, setCertificatesLoading] = useState<boolean>(true)
  const [claimOpen, setClaimOpen] = useState<boolean>(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const [claimLoading, setClaimLoading] = useState<boolean>(false)

  // Run a 1s interval for checking if MNC is running
  useAsyncEffect(() => {
    const intervalId = setInterval(() => {
      checkForMetaNetClient().then(hasMNC => {
        if (hasMNC === 0) {
          setIsMncMissing(true) // Open modal if MNC is not found
        } else {
          setIsMncMissing(false) // Ensure modal is closed if MNC is found
          clearInterval(intervalId)
        }
      }).catch(error => {
        console.error('Error checking for MetaNet Client:', error)
      })
    }, 1000)

    // Return a cleanup function
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Creates a new METAWATT certificate token
  const handleBuyCertificate = async (certId: string): Promise<void> => {
    try {
      // Find the certificate in the marketplace
      const cert = marketplaceCertificates.find(c => c.id === certId)
      if (!cert) {
        toast.error('Certificate not found!')
        return
      }

      // Start loading animation
      setBuyLoading(true)
      setSelectedCertId(certId)

      // Create certificate data string
      const certData = JSON.stringify(cert)

      // Encrypt the certificate data
      const encryptedCert = (await walletClient.encrypt({
        plaintext: Utils.toArray(certData, 'utf8'),
        protocolID: [0, 'metawatt'],
        keyID: '1'
      })).ciphertext

      // Create a PushDrop Bitcoin token for the certificate
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(METAWATT_PROTO_ADDR, 'utf8') as number[], 
          encryptedCert
        ],
        [0, 'metawatt'],
        '1',
        'self'
      )

      // Create a Bitcoin transaction for the new certificate token
      const newCertificateToken = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: cert.price,
          basket: 'metawatt certificates',
          outputDescription: `Renewable Energy Certificate: ${cert.source} - ${cert.amount}`
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Purchase Renewable Energy Certificate: ${cert.source} - ${cert.amount}`
      })

      // Success message and update state
      toast.dark('Certificate purchased successfully!')
      setCertificates([
        {
          certData: cert,
          sats: cert.price,
          outpoint: `${newCertificateToken.txid}.0`,
          lockingScript: bitcoinOutputScript.toHex(),
          beef: newCertificateToken.tx
        },
        ...certificates
      ])
    } catch (e) {
      toast.error((e as Error).message)
      console.error(e)
    } finally {
      setBuyLoading(false)
      setSelectedCertId(null)
    }
  }

  // Claims a certificate token, returning the satoshis
  const handleClaimSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    try {
      setClaimLoading(true)

      if (selectedCertificate === null) {
        throw new Error('selectedCertificate does not exist')
      }

      // Create a description for the action
      let description = `Claim Renewable Energy Certificate: ${selectedCertificate.certData.source} - ${selectedCertificate.certData.amount}`
      if (description.length > 128) { 
        description = description.substring(0, 128) 
      }

      const txid = selectedCertificate.outpoint.split('.')[0]
      const loadedBeef = Beef.fromBinary(selectedCertificate.beef as number[])
      const ok = await loadedBeef.verify(await new Services('main').getChainTracker(), true)

      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: loadedBeef.toBinary(),
        inputs: [{
          inputDescription: 'Claim Renewable Energy Certificate',
          outpoint: selectedCertificate.outpoint,
          unlockingScriptLength: 73
        }],
        options: {
          randomizeOutputs: false
        }
      })

      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)

      // Unlock the token
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

      // Sign the action to claim the certificate
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      console.log(signResult)

      // Success message and update state
      toast.dark('Certificate claimed successfully! 🎉')
      setCertificates((oldCerts) => {
        const index = oldCerts.findIndex(x => x === selectedCertificate)
        if (index > -1) oldCerts.splice(index, 1)
        return [...oldCerts]
      })
      setSelectedCertificate(null)
      setClaimOpen(false)
    } catch (e) {
      toast.error(`Error claiming certificate: ${(e as Error).message}`)
      console.error(e)
    } finally {
      setClaimLoading(false)
    }
  }

  // Load existing certificate tokens from the user's basket
  useEffect(() => {
    void (async () => {
      try {
        // Fetch existing certificates from the user's basket
        const certsFromBasket = await walletClient.listOutputs({
          basket: 'metawatt certificates',
          include: 'entire transactions'
        })

        // Decrypt and process the certificates
        let txid: string
        const decryptedCertsResults = await Promise.all(certsFromBasket.outputs.map(async (cert: WalletOutput, i: number) => {
          try {
            txid = certsFromBasket.outputs[i].outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(certsFromBasket.BEEF as number[], cert.outpoint.split('.')[0])
            const lockingScript = tx!.outputs[0].lockingScript

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
              certData: certData,
              beef: certsFromBasket.BEEF
            }
          } catch (error) {
            console.error('Error decrypting certificate:', error)
            return null
          }
        }))

        // Filter out nulls (errors) and reverse the order
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

  // Opens the claim dialog for the selected certificate
  const openClaimModal = (cert: Certificate) => () => {
    setSelectedCertificate(cert)
    setClaimOpen(true)
  }

  return (
    <>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />
      <ToastContainer
        position='top-right'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <AppBar position='static'>
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            METAWATT — Renewable Energy Certificates
          </Typography>
          <GitHubIconStyle onClick={() => window.open('https://github.com/metawatt', '_blank')}>
            <GitHubIcon />
          </GitHubIconStyle>
        </Toolbar>
      </AppBar>
      <AppBarPlaceholder />

      {/* Marketplace Section */}
      <Typography variant='h4' sx={{ margin: '1em' }}>Marketplace</Typography>
      <MarketplaceContainer container spacing={2}>
        {marketplaceCertificates.map((cert) => (
          <Grid item xs={12} sm={6} md={4} key={cert.id}>
            <CertificateCard>
              <CardContent>
                <Typography variant='h5'>{cert.source}</Typography>
                <Typography variant='body1'>Location: {cert.location}</Typography>
                <Typography variant='body1'>Amount: {cert.amount}</Typography>
                <Typography variant='body1'>Date: {cert.date}</Typography>
                <Typography variant='body1'>Price: {cert.price} satoshis</Typography>
              </CardContent>
              <CardActions>
                <Button 
                  variant='contained' 
                  color='primary'
                  disabled={buyLoading && selectedCertId === cert.id}
                  onClick={() => { void handleBuyCertificate(cert.id) }}
                >
                  {buyLoading && selectedCertId === cert.id ? 'Processing...' : 'Buy Certificate'}
                </Button>
              </CardActions>
            </CertificateCard>
          </Grid>
        ))}
      </MarketplaceContainer>

      {/* My Certificates Section */}
      <Typography variant='h4' sx={{ margin: '1em' }}>My Certificates</Typography>
      {certificatesLoading ? (
        <LoadingBar />
      ) : (
        <List>
          {certificates.length === 0 && (
            <NoItems container direction='column' justifyContent='center' alignItems='center'>
              <Grid item justifyContent="center" alignItems="center">
                <Typography variant='h5'>No Certificates Owned</Typography>
                <Typography color='textSecondary'>
                  Purchase certificates from the marketplace above
                </Typography>
              </Grid>
            </NoItems>
          )}
          {certificates.map((cert, i) => (
            <ListItem key={i} button onClick={openClaimModal(cert)}>
              <ListItemIcon><Checkbox checked={false} /></ListItemIcon>
              <ListItemText 
                primary={`${cert.certData.source} - ${cert.certData.amount}`} 
                secondary={`${cert.sats} satoshis - Click to claim`} 
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Claim Certificate Dialog */}
      <Dialog open={claimOpen} onClose={() => { setClaimOpen(false) }}>
        <form onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              await handleClaimSubmit(e)
            } catch (error) {
              console.error('Error in form submission:', error)
            }
          })()
        }}>
          <DialogTitle>Claim Certificate</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              Are you sure you want to claim this certificate? You'll receive back your {selectedCertificate?.sats} satoshis.
            </DialogContentText>
            {selectedCertificate && (
              <>
                <Typography variant='subtitle1'>Source: {selectedCertificate.certData.source}</Typography>
                <Typography variant='subtitle1'>Amount: {selectedCertificate.certData.amount}</Typography>
                <Typography variant='subtitle1'>Location: {selectedCertificate.certData.location}</Typography>
                <Typography variant='subtitle1'>Date: {selectedCertificate.certData.date}</Typography>
              </>
            )}
          </DialogContent>
          {claimLoading ? (
            <LoadingBar />
          ) : (
            <DialogActions>
              <Button onClick={() => { setClaimOpen(false) }}>Cancel</Button>
              <Button type='submit' variant='contained' color='primary'>Claim Certificate</Button>
            </DialogActions>
          )}
        </form>
      </Dialog>
    </>
  )
}

export default App