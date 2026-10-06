# Prompts

Return Agent was built with Claude from one detailed product prompt, then shaped by short follow-up prompts while using it.

## Iteration prompts

| # | Prompt | What changed |
| --- | --- | --- |
| 1 | I want to make it real, like connect to my Gmail. Does that make sense? | Real Gmail sync: read-only OAuth, Claude extraction, verification against the email text |
| 2 | For an individual, simplifying life, what makes the most sense? | Hosted agent with a daily background check instead of a local app |
| 3 | This is getting really complicated. What is Node.js helping me with? | Browser-only deploy path through GitHub and Vercel |
| 4 | I want to create a shareable link for someone to test it out. | Demo inbox as the shared experience; preview copy for testers |
| 5 | Is there a way to give them a format to move cards around or give me feedback? | Customize mode: drag, resize, hide modules; share layout as a link |
| 6 | How are you identifying what to return? | Clarified the decision model; added set-your-own deadline |
| 7 | Can I connect Amazon? / Add Amazon to the demo. | Amazon via a second household inbox |
| 8 | I don't always want to open an app. Can it send me an email digest every 2 days? | Background digest: every 2 days, sooner when urgent, silent on quiet days |
| 9 | Let's add the test email. | Owner-only sample digest |
| 10 | Why does it show Connect Gmail and also Try with demo purchases? | One primary button on the preview site |
| 11 | Is there a way to make the labels/QR code available in the email? | Scannable return codes in the digest; keeps the retailer's original QR |
| 12 | Can this agent actually create the return labels? | Decided to ship as is; roadmap: assisted returns, then a browser agent |

## Original build prompt (word for word)

I want you to build a polished web app called Return Agent.
The product is a personal AI agent that helps people manage online shopping returns automatically.
The problem
I shop online frequently and often have multiple items I intend to return.
The current return process is surprisingly painful:

* I forget which purchases I planned to return.
* I forget return deadlines and sometimes lose the ability to return something.
* Order numbers are buried in email.
* I have to search through email to figure out where I purchased something.
* Every retailer has a different return flow.
* QR codes and shipping labels end up scattered across email and downloads.
* I don't always remember whether I actually received the refund after dropping something off.

I want an agent that eventually manages the entire lifecycle:
purchase → decide → initiate return → drop off → refund
For this first version, focus on automatically discovering purchases from email, organizing them, identifying what needs attention, and managing the return workflow.
IMPORTANT: Do not include Amazon anywhere in V1. Amazon purchases are associated with another household email account and will be handled as a future integration.
PRODUCT PRINCIPLE
This should NOT feel like a CRUD-based returns tracker.
It should feel like an agent doing administrative work for me.
The user should feel:
“Return Agent already knows what I bought and tells me what I need to do.”
The primary experience should therefore be:
Connect Gmail → agent discovers purchases → Returns Inbox appears automatically
Manual entry should exist only as a fallback.
TECH STACK
Use:

* Next.js
* TypeScript
* Tailwind CSS
* Supabase-ready data architecture
* GitHub
* Vercel deployment

Keep the implementation simple enough to build and demo within a few hours.
Use reusable components and clean code.
Do not over-engineer authentication.
EXPERIENCE 1 — ONBOARDING
For a first-time user, show:
Return Agent
Never miss a return again.
Return Agent finds your purchases, tracks return deadlines, organizes your returns, and makes sure you get your money back.
Primary CTA:
Connect Gmail
Supporting copy:
Return Agent only looks for purchase, shipping, return, and refund emails.
Secondary option:
Try with demo purchases
EXPERIENCE 2 — PURCHASE DISCOVERY
After Gmail is connected, show an agent processing experience.
Example:
Finding your purchases...
Searching recent order confirmations and shipping emails.
Then show agent activity updating:
✓ Found Nike order confirmation
✓ Found Nordstrom purchase
✓ Matched Lululemon shipment to order
✓ Found Zara order
✓ Found HOKA purchase
✓ Found Target order
Then:
12 purchases found
Review purchases →
For V1, if Gmail OAuth is not yet configured, create this experience using realistic demo data but structure the code so real Gmail ingestion can be connected next.
Do not block the entire application on Gmail OAuth configuration.
PURCHASE EXTRACTION
Design the data model so purchase emails can eventually be processed to extract:

* retailer
* item name
* product image if available
* price
* order number
* order date
* source email
* order URL
* estimated return deadline
* return status
* refund status

Never invent missing information.
If something cannot be determined confidently, show:
Needs verification
Every imported purchase should have:
View source email
so users understand where the agent obtained the information.
MAIN DASHBOARD
The dashboard should immediately answer:
What do I need to return and what should I do next?
Design this as a beautiful consumer product.
Think:
Apple
Shop
Klarna
modern personal finance apps
NOT:
Salesforce
Jira
enterprise admin software
Use:

* lots of whitespace
* large typography
* clean cards
* subtle borders
* rounded corners
* restrained color
* high-quality visual hierarchy

Header:
Return Agent
Never miss a return again.
SUMMARY
At the top show something like:
$842
Waiting to be returned
7 items
2 deadlines this week
$312 at risk
Use realistic demo numbers calculated from the underlying purchase data.
AGENT ALERT
Show an intelligent alert:
2 returns need your attention
Nike Pegasus 41
$160
Return by Oct 9
4 days left
Lululemon Align Jacket
$148
Return by Oct 11
6 days left
CTA:
Review returns
The purpose is to make the agent prioritize what matters instead of making the user inspect every purchase.
RETURNS INBOX
Create tabs:
ALL
DECIDE
RETURN
DROP OFF
REFUNDS
Populate with approximately 12 realistic purchases from retailers such as:
Nike
Lululemon
Nordstrom
Zara
Target
HOKA
Sephora
Aritzia
Do NOT include Amazon.
Each purchase should be displayed as a polished visual card.
Example:
NIKE
Pegasus 41
$160
Ordered Sep 14
Return by Oct 9
4 days left
[ RETURN ]
[ KEEP ]
View order
View source email
Another:
LULULEMON
Align High-Rise Pant
$118
Ordered Sep 18
Return by Oct 15
10 days left
[ RETURN ]
[ KEEP ]
PURCHASE STATES
Support:
DECIDE
KEEP
RETURN
RETURN STARTED
READY TO DROP OFF
DROPPED OFF
REFUNDED
The UI should make these states visually obvious without feeling cluttered.
RETURN EXPERIENCE
When the user clicks:
RETURN
Open a return panel.
Ask:
Why are you returning this?
Options:
Too small
Too large
Didn't like it
Changed my mind
Quality issue
Arrived damaged
Other
Then:
How would you like to return it?
Example options depending on retailer:
UPS Store
FedEx
USPS
Retail store
Mail
Then:
Start return
For V1, simulate the retailer interaction.
Clearly label this internally as mocked/demo behavior in the code.
Do not falsely represent that the retailer return has actually been submitted.
RETURN READY
After completing the simulated return flow, show:
Return ready
Nike Pegasus 41
Refund:
$160
Return at:
UPS Store
Show a realistic placeholder QR code or shipping label.
Show:
Return by Oct 9
CTA:
Mark as dropped off
READY TO DROP OFF
This is an important product experience.
Do NOT simply show a list of returns.
Group returns by where the user needs to physically take them.
Example:
Ready to Drop Off
UPS STORE
3 items
Nike Pegasus 41
Nordstrom Dress
HOKA Clifton
$436 total refund
[ Show return codes ]
FEDEX
2 items
Zara Jacket
Aritzia Top
$197 total refund
[ Show labels ]
The product should help the user think:
“I need to make one UPS trip and take these three things.”
rather than:
“I have three unrelated returns.”
REFUND TRACKER
Create:
Refunds
Example:
Nike Pegasus 41
Dropped off Oct 3
Expected refund:
$160
Status:
Waiting for refund
Nordstrom Dress
Refund:
$189
Status:
Refund received
Received Oct 4
If a refund has been outstanding unusually long:
Refund overdue
$148
Dropped off 12 days ago
CTA:
Check refund
AGENT INSIGHT
Include an intelligent agent card on the dashboard.
Example:
Return Agent
You currently have $842 worth of items marked for return.
$308 of returns expire in the next 7 days.
Your best next action is one UPS trip:
3 items · $436 refund
CTA:
Show me what to take
This should be one of the most visually prominent parts of the product.
AGENT ACTIVITY
Create a section:
What Return Agent handled
Example timeline:
✓ Found Nike order confirmation
✓ Extracted order #NK48291
✓ Identified 2 purchased items
✓ Found return deadline
✓ Return marked
✓ Return code generated
✓ Package dropped off
✓ Refund detected
This is important because it makes the product feel like an agent doing work rather than a database.
RETURN DEADLINES
Do NOT hallucinate return policies.
If a return policy has not been verified, show:
Return deadline needs verification
Structure the application so a retailer-policy lookup service can be added later.
For demo purchases, verified deadlines can be included in the fixture data.
ADD PURCHASE
Include:
+ Add Purchase
Manual entry fields:
Retailer
Item
Price
Order date
Order number
Return deadline
This should be a fallback, NOT the primary workflow.
DATA MODEL
Create a simple data architecture around:
User
Purchase
Return
ReturnMethod
Refund
AgentActivity
EmailSource
Each purchase should be capable of referencing the email it came from.
DEMO DATA
Populate approximately 12 purchases.
Use dates around October 2026.
Use retailers such as:
Nike
Lululemon
Nordstrom
Zara
Target
HOKA
Sephora
Aritzia
Mix states:
3 DECIDE
3 RETURN
3 READY TO DROP OFF
1 DROPPED OFF
2 REFUNDED
Make the demo data realistic.
FUTURE AGENT ARCHITECTURE
Document the following future architecture in the README, but do not attempt to implement everything now.
Email ingestion
Gmail API
Search for:
order confirmations
shipping confirmations
delivery notifications
return confirmations
refund confirmations
AI extraction
Use an LLM to extract:
retailer
order number
items
price
purchase date
order link
Return policy agent
Look up retailer return policies.
Determine:
return window
deadline
exceptions
return methods
Never invent policies.
Browser agent
Eventually use Playwright or browser/computer-use automation to:
open retailer
find order
navigate return flow
select item
select return reason
select return method
retrieve QR code or shipping label
The user should confirm before any consequential return submission.
Return artifact storage
Store:
QR codes
shipping labels
drop-off instructions
refund amount
return deadline
Eventually create one consolidated place for everything needed to complete returns.
Refund agent
Monitor email for:
return received
refund initiated
refund completed
Update status automatically.
Alert if a refund appears overdue.
Scheduled agent
Eventually run once per day.
Example:
Every morning Return Agent checks for:
new purchases
upcoming return deadlines
returns not dropped off
refunds not received
Then surfaces only things requiring attention.
Multi-inbox support
Future capability:
Allow multiple authorized household email accounts to contribute purchase information to one Return Agent account.
Do NOT implement this now.
PRIVACY / TRUST
Because this product accesses email, trust is important.
Include clear product language explaining that Return Agent searches only for shopping-related emails needed to manage purchases and returns.
The agent should expose its source whenever possible.
Do not imply actions occurred when they were simulated.
Use confirmation before consequential actions.
DESIGN
This should look like a real consumer startup product someone would want to use.
Avoid generic AI gradients and excessive chatbot UI.
The agent should mostly work quietly in the background.
AI should be visible through:
prioritization
automation
agent activity
recommendations
not through a giant chat box.
Make the experience polished on desktop and mobile.
BUILD PRIORITY
Prioritize in this order:

1. Beautiful dashboard
2. Returns Inbox
3. Purchase states
4. Return interaction
5. Ready to Drop Off grouping
6. Refund tracking
7. Agent insight/activity
8. Gmail-ready architecture
9. Mobile responsiveness

Do not spend excessive time implementing infrastructure before the core experience works.
DEMO STORY
The application needs to support a compelling approximately 5-minute demo.
The story:
“I shop online constantly, and returns became a small administrative job.
I would forget what I wanted to return, hunt through emails for order numbers, miss deadlines, have return labels everywhere, and sometimes forget to check whether I got my refund.
So I built Return Agent.”
Then demonstrate:

1. Connect Gmail.
2. Agent discovers purchases.
3. Dashboard shows total money waiting to be returned.
4. Agent identifies deadlines requiring attention.
5. Mark a purchase for return.
6. Select return reason.
7. Generate simulated return.
8. Show return QR/label.
9. Show multiple returns grouped into one UPS trip.
10. Show refund tracking.
11. Show what the agent handled automatically.

The key product idea:
Return Agent doesn't just track returns. It handles the administrative work surrounding returns.
IMPLEMENTATION INSTRUCTIONS
Now build the complete working application.
After implementation:

1. Run the application.
2. Fix all TypeScript errors.
3. Fix all build errors.
4. Test the primary interactions.
5. Make sure demo data loads correctly.
6. Make sure the app works on desktop and mobile.
7. Create a concise README.
8. Explain what is real vs mocked in the current prototype.
9. Explain exactly how Gmail ingestion should be connected in the next iteration.
10. Do not stop after scaffolding. Build the usable frontend and interactions.
