import { createContext, useContext } from 'react'

// The single "Viewing Organization" selection, provided once by Layout and read
// by any page via useViewOrg(). For a super-admin it is the org they're viewing
// (switchable in the global header bar); for an org user it is their own org.
// Persisted in localStorage under the same key OrgPicker uses, so the choice
// carries across screens and stays in sync with any not-yet-migrated page.
export const ViewOrgContext = createContext({
  viewOrgId: '',
  setViewOrgId: () => {},
  orgs: [],
  isSuperAdmin: false,
  orgName: '',
})

export const useViewOrg = () => useContext(ViewOrgContext)
