import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function Estimate({ profile }) {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [categories, setCategories] = useState([])
  const [pickCategory, setPickCategory] = useState('')
  const [servicesInCategory, setServicesInCategory] = useState([])
  const [pickServiceId, setPickServiceId] = useState('')
  const [matchingVariants, setMatchingVariants] = useState([])
  const [pickPartSource, setPickPartSource] = useState('')
  const [addingService, setAddingService] = useState(false)

  const [customDesc, setCustomDesc] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customPrice, setCustomPrice] = useState('')
  const [customTaxable, setCustomTaxable] = useState(true)
  const [addingCustom, setAddingCustom] = useState(false)

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [taxRate, setTaxRate] = useState(0)

  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError] = useState('')

  async function loadJobAndEstimate() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, org_id, customer_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
      .eq('id', jobId)
      .single()
    setJob(jobData)

    if (!jobData) {
      setLoading(false)
      return
    }

    let { data: existingEstimate } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .eq('kind', 'estimate')
      .maybeSingle()

    if (!existingEstimate) {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', jobData.org_id)
        .eq('kind', 'estimate')
      const estimateNumber = 'EST-' + String((count || 0) + 1).padStart(4, '0')

      const { data: created } = await supabase
        .from('invoices')
        .insert({
          org_id: jobData.org_id,
          invoice_number: estimateNumber,
          job_id: jobId,
          invoice_date: new Date().toISOString().slice(0, 10),
          bills_to_customer_id: jobData.customer_id,
          discount_type: 'dollar',
          kind: 'estimate',
        })
        .select()
        .single()
      existingEstimate = created

      if (jobData.trip_charge_price_id && jobData.trip_charge) {
        const tc = jobData.trip_charge
        await supabase.from('invoice_line_items').insert({
          invoice_id: created.id,
          org_id: jobData.org_id,
          description: tc.customer_display,
          unit_price: tc.price,
          quantity: 1,
          taxable: !tc.services?.is_tax_exempt,
          is_custom: false,
          sort_order: 1,
        })
      }
    }

    setEstimate(existingEstimate)
    setDiscountType(existingEstimate.discount_type || 'dollar')
    setDiscountAmount(String(existingEstimate.discount_amount || 0))

    await loadLineItems(existingEstimate.id)

    const { data: cats } = await supabase
      .from('services')
      .select('category')
      .eq('org_id', jobData.org_id)
      .eq('is_active', true)
      .neq('category', 'TRIP CHARGES')
    setCategories([...new Set((cats || []).map((c) => c.category))].sort())

    const { data: orgData } = await supabase
      .from('organizations')
      .select('sales_tax_rate, services_taxable_by_default')
      .eq('id', jobData.org_id)
      .single()
    if (orgData) {
      setTaxRate(orgData.sales_tax_rate || 0)
      setCustomTaxable(orgData.services_taxable_by_default)
    }

    setLoading(false)
  }

  async function loadLineItems(estimateId) {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', estimateId)
      .order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => {
    loadJobAndEstimate()
  }, [jobId])

  useEffect(() => {
    if (!pickCategory || !job) {
      setServicesInCategory([])
      return
    }
    supabase
      .from('services')
      .select('id, name, is_tax_exempt')
      .eq('org_id', job.org_id)
      .eq('category', pickCategory)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setServicesInCategory(data || []))
  }, [pickCategory, job])

  useEffect(() => {
    if (!pickServiceId || !job?.trip_charge) {
      setMatchingVariants([])
      return
    }
    supabase
      .from('service_prices')
      .select('id, part_source, customer_display, price')
      .eq('service_id', pickServiceId)
      .eq('location', job.trip_charge.location)
      .eq('access', job.trip_charge.access)
      .eq('hours', job.trip_charge.hours)
      .eq('is_active', true)
      .then(({ data }) => {
        setMatchingVariants(data || [])
        setPickPartSource('')
      })
  }, [pickServiceId, job])

  const resolvedVariant =
    matchingVariants.length === 1
      ? matchingVariants[0]
      : matchingVariants.find((v) => (v.part_source || '') === pickPartSource) || null

  async function handleAddService() {
    if (!resolvedVariant) return
    setAddingService(true)
    const svc = servicesInCategory.find((s) => s.id === pickServiceId)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: resolvedVariant.customer_display,
      unit_price: resolvedVariant.price,
      quantity: 1,
      taxable: !svc?.is_tax_exempt,
      is_custom: false,
      sort_order: nextSort,
    })
    setAddingService(false)
    setPickCategory('')
    setPickServiceId('')
    setMatchingVariants([])
    loadLineItems(estimate.id)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customDesc.trim() || !customPrice) return
    setAddingCustom(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: customDesc.trim(),
      unit_price: parseFloat(customPrice) || 0,
      quantity: parseFloat(customQty) || 1,
      taxable: customTaxable,
      is_custom: true,
      sort_order: nextSort,
    })
    setAddingCustom(false)
    setCustomDesc('')
    setCustomQty('1')
    setCustomPrice('')
    loadLineItems(estimate.id)
  }

  async function removeLineItem(id) {
    await supabase.from('invoice_line_items').delete().eq('id', id)
    loadLineItems(estimate.id)
  }

  async function updateLineItem(id, field, value) {
    await supabase.from('invoice_line_items').update({ [field]: value }).eq('id', id)
    loadLineItems(estimate.id)
  }

  async function saveDiscount() {
    await supabase
      .from('invoices')
      .update({ discount_type: discountType, discount_amount: parseFloat(discountAmount) || 0 })
      .eq('id', estimate.id)
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: estimate.id } })
    setSendingEmail(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch {}
      }
      setSendError(detail)
    } else if (data?.error) {
      setSendError(data.error)
    } else {
      loadJobAndEstimate()
    }
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountValue =
    discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!estimate) return
    supabase
      .from('invoices')
      .update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue })
      .eq('id', estimate.id)
      .then(() => {})
  }, [subtotal, salesTax, totalDue, estimate])

  return (
