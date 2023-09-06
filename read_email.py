import sys
import os
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
import os.path
import base64
import email
from bs4 import BeautifulSoup

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def extract(text):
  	a = text.split()
  	return a[a.index('Email:')+1]

############################################################

def getEmails():
	creds = None
	if os.path.exists('token.pickle'):
		with open('token.pickle', 'rb') as token:
			creds = pickle.load(token)

	if not creds or not creds.valid:
		if creds and creds.expired and creds.refresh_token:
			creds.refresh(Request())
		else:
			flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
			creds = flow.run_local_server(port=0)
		with open('token.pickle', 'wb') as token:
			pickle.dump(creds, token)

	# Connect to the Gmail API
	service = build('gmail', 'v1', credentials=creds)

	# request a list of all the messages
	result = service.users().messages().list(userId='me').execute()

	# We can also pass maxResults to get any number of emails. Like this:
	# result = service.users().messages().list(maxResults=200, userId='me').execute()
	messages = result.get('messages')

	# iterate through all the messages
	txt = {}
	for msg in messages:
		# Get the message from its id
		txt1 = service.users().messages().get(userId='me', id=msg['id']).execute()
		try:
			# if txt1['labelIds'] == ['CATEGORY_PROMOTIONS', 'UNREAD', 'IMPORTANT', 'INBOX'] and 'Please verify your email address to complete registration Upwork Verify your email address to complete registration' in txt1['snippet']:
			if txt1['labelIds'] ==  ['UNREAD', 'IMPORTANT', 'CATEGORY_UPDATES', 'INBOX'] and 'Please verify your email address to complete registration Upwork Verify your email address to complete registration' in txt1['snippet']:
				txt = txt1
			if txt != {}:
				break
		except:
			pass
	if txt == {}:
		return getEmails()
	else:
		# Get the data and decode it with base 64 decoder.
		data = txt['payload'].get('parts')[0]['body']['data']
		data = data.replace("-","+").replace("_","/")
		decoded_data = base64.b64decode(data)
		soup = BeautifulSoup(decoded_data , "lxml")
		body = soup.body()
		verifyURL = extract(str(body))
		return verifyURL

email = getEmails()
sys.stdout.write(email)
