'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmailResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    message: string;
  };
}

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Test Email from MLS Listings');
  const [message, setMessage] = useState('This is a test email to verify the email functionality is working correctly.');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<EmailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: subject,
          text: message,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data);
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const testQuickSend = async () => {
    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'geocodingmls@gmail.com',
          subject: 'Quick Test Email',
          text: 'This is a quick test email from MLS Listings application.',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data);
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Email Test API</CardTitle>
          <p className="text-sm text-gray-600">
            Test the Mailgun email functionality by sending a test email.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div>
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recipient@example.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            
            <div>
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Email message content"
              />
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading || !email}>
                {isLoading ? 'Sending...' : 'Send Test Email'}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={testQuickSend}
                disabled={isLoading}
              >
                Quick Test to geocodingmls@gmail.com
              </Button>
            </div>
          </form>

          {response && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-600">✅ Email sent successfully!</p>
                  <p><strong>Message ID:</strong> {response.data?.id}</p>
                  <p><strong>Status:</strong> {response.data?.message}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-semibold">❌ Error:</p>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="font-semibold mb-2">API Endpoint Information:</h3>
            <p><strong>URL:</strong> <code>/api/test-email</code></p>
            <p><strong>Method:</strong> POST</p>
            <p><strong>Content-Type:</strong> application/json</p>
            <pre className="mt-2 text-sm bg-gray-100 p-2 rounded overflow-x-auto">
{`{
  "to": "recipient@example.com",
  "subject": "Optional subject",
  "text": "Email content",
  "html": "Optional HTML content"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
